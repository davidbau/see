// see.js
//
// An simple interactive eval tool for JavaScript.
//
// Provides an interactive eval panel that can be used to inspect
// variable state within nested scopes.  Also provides a simple
// in-page logging facility with tree view inspection of objects.
//
// Overview:
//
// See can be used to debug a nested scope by making a call to
// eval(see.scope('myscope')); within the scope of interest.
// For example, the following nicely encapsulated code would normally
// be difficult to debug without the added see lines:
//
// see.init();
// (function() {
//   eval(see.scope('wrap'));
//   var private_var = 0;
//   function myclosuremaker() {
//     eval(see.scope('inner'));
//     var counter = 0;
//     return function() { ++counter; }
//   }
//   var inc = myclosuremaker();
// })();
//
// To switch scopes within the interactive panel, just enter ":" followed
// by the scope name, for example, ":inner", or ":wrap" in the example above.
//
// An eval function passed to init will be used for the default scope (":").
//
// Here it how to initialize see to interpret CoffeeScript at the current scope:
//
//   see.init(eval(see.cs))
//
// The see package can also be used for normal logging, similar to
// console.log, but producing output within the document itself.  Calling
// see as a function will log a tree representation of the arguments.
// The logged objects will be traversed to a fixed depth (default 5) at
// the moment they are logged, instead of later when you expand the tree.
//
// Detailed usage:
//
//   see.init();               // Creates the interactive panel.
//   see.init({height: 30, title: 'test panel'});   // Sets some options.
//   eval(see.init());         // Sets the default scope to local scope.
//   see.loghtml();            // Logs HTML without escaping.
//   r = see.repr(a, 3);       // Builds a tree representation of a to depth 3.
//   see.noconflict();         // Restores window.see to its old value.
//   eval(see.scope('name'));  // Type ":name" in the panel to use this scope. 
//   see(a, b, c);             // Logs values into the panel.
//
// Options to pass to init:
//
//   eval: The default function (or closure) to use to evaluate expressions.
//   this: The object to use as "this" within the evaluation.
//   depth: The depth to which to traverse logged and evaluated objects.
//   height: The pixel height of the interactive panel.
//   title: A title shown at the top of the panel.
//   panel: false if no interactive panel is desired.
//   console: set to window.console to echo logging to the console also.
//   history: set to false to disable localStorage use for interactive history.
//   linestyle: css style for a single log line.
//   element: (if panel is false) - the element into which to logging is done.
//   autoscroll: (if panel is false) - the element to autoscroll to bottom.
//   jQuery: the page's local copy of jQuery to reuse.
//   coffee: the CoffeeScript compiler object, for coffeescript support.
//
// Some implementation notes on interactions:
//
// When see.init() is called, a private (noconflict) copy of jQuery is
// loaded if jQuery is not already present on the page (unless the 'panel'
// option is false, or the 'jQuery' option is explicity supplied).
//
// Every expression entered in the panel is stored to '_loghistory' in
// localStorage unless the 'history' option is set to false.

(function() {

var seepkg = 'see'; // Defines the global package name used.
var hasoldsee = window.hasOwnProperty(seepkg);
var didnoconflict = false;
var oldsee;
if (hasoldsee) {
  oldsee = window[seepkg];
}

// Option defaults
var $ = window.jQuery;
var evalfunction = window.eval;
var evalthis = window;
var linestyle = 'position:relative;font-family:monospace;' +
  'word-break:break-all;margin-bottom:3px;padding-left:1em;';
var logdepth = 5;
var autoscroll = false;
var logelement = 'body';
var panel = true;
var see;  // defined below.
var paneltitle = '';
var logconsole = null;
var uselocalstorage = '_loghistory';
var panelheight = 100;
var currentscope = '';
var scopes = { top: { e: window.eval, t: window } };
var coffeescript = window.CoffeeScript;
var seejs = '(function(){return eval(arguments[0]);})';
var seecs = '(function(){return eval(' + seepkg + '.barecs(arguments[0]));})';

function init(options) {
  if (arguments.length === 0) {
    options = {};
  } else if (arguments.length == 2) {
    var newopt = {};
    newopt[arguments[0]] = arguments[1];
    options = newopt;
  } else if (arguments.length == 1 && typeof arguments[0] == 'function') {
    options = {'eval': arguments[0]};
  }
  if (options.hasOwnProperty('jQuery')) { $ = options.jQuery; }
  if (options.hasOwnProperty('eval')) { evalfunction = options['eval']; }
  if (options.hasOwnProperty('this')) { evalthis = options['this']; }
  if (options.hasOwnProperty('element')) { logelement = options.element; }
  if (options.hasOwnProperty('autoscroll')) { autoscroll = options.autoscroll; }
  if (options.hasOwnProperty('linestyle')) { linestyle = options.linestyle; }
  if (options.hasOwnProperty('depth')) { logdepth = options.depth; }
  if (options.hasOwnProperty('panel')) { panel = options.panel; }
  if (options.hasOwnProperty('height')) { panelheight = options.height; }
  if (options.hasOwnProperty('title')) { paneltitle = options.title; }
  if (options.hasOwnProperty('console')) { logconsole = options.console; }
  if (options.hasOwnProperty('history')) { uselocalstorage = options.history; }
  if (options.hasOwnProperty('coffee')) { coffeescript = options.coffee; }
  if (panel) {
    // panel overrides element and autoscroll.
    logelement = '#_testlog';
    autoscroll = '#_testpanel';
    loadjQueryIfNotPresent(tryinitpanel);
  }
  var suffix = '';
  if (options.noconflict) {
    suffix = seepkg + '.noconflict();';
  }
  return scope() + suffix;
}

function scope(name, evalfunc, evalthis) {
  if (arguments.length <= 1) {
    if (!arguments.length) {
      name = '';
    }
    return seepkg + '.scope(' + cstring(name) + ',' + seejs + ')';
  }
  scopes[name] = { e: evalfunc, t: evalthis };
}

var varpat = '[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*';
var initialvardecl = new RegExp(
  '^\\s*var\\s+(?:' + varpat + '\\s*,)*' + varpat + '\\s*;\\s*');

function barecs(s) {
  // Compile coffeescript in bare mode.
  var compiler = coffeescript || window.CoffeeScript;
  var compiled = compiler.compile(s, {bare:1});
  if (compiled) {
    // Further strip top-level var decls out of the coffeescript so
    // that assignments can leak out into the enclosing scope.
    compiled = compiled.replace(initialvardecl, '');
  }
  return compiled;
}

function exportsee() {
  see.repr = repr;
  see.loghtml = loghtml;
  see.noconflict = noconflict;
  see.init = init;
  see.scope = scope;
  see.barecs = barecs;
  see.js = seejs;
  see.cs = seecs;
  window[seepkg] = see;
}

function noconflict() {
  if (!didnoconflict) {
    if (!hasoldsee) {
      delete window[seepkg];
    } else {
      window[seepkg] = oldsee;
    }
    didnoconflict = true;
  }
  return see;
}

function loadjQueryIfNotPresent(callback) {
  if ($ && $.fn && $.fn.jquery) {
    callback();
    return;
  }
  function loadscript(src, callback) {
    function setonload(script, fn) {
      script.onload = script.onreadystatechange = fn;
    }
    var script = document.createElement("script"),
       head = document.getElementsByTagName("head")[0],
       pending = 1;
    setonload(script, function() {
      if (pending && (!script.readyState ||
          {loaded:1,complete:1}[script.readyState])) {
        pending = 0;
        callback();
        setonload(script, null);
        head.removeChild(script);
      }
    });
    script.src = src;
    head.appendChild(script);
  }
  loadscript(
      '//ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js',
      function() {
    $ = jQuery.noConflict(true);
    callback();
  });
}

// ---------------------------------------------------------------------
// LOG FUNCTION SUPPORT
// ---------------------------------------------------------------------
var logcss = "input._log:focus{outline:none;}label._log > span:first-of-type:hover{text-decoration:underline;}div._log > label._log,div_.log > span > label._log{display:inline-block;vertical-align:top;}label._log > span:first-of-type{margin-left:2em;text-indent:-1em;}label._log > ul{display:none;padding-left:14px;margin:0;}label._log > span:before{content:'';font-size:70%;font-style:normal;display:inline-block;width:0;text-align:center;}label._log > span:first-of-type:before{content:'\\0025B6';}label._log > ul > li{display:block;white-space:pre-line;margin-left:2em;text-indent:-1em}label._log > ul > li > div{margin-left:-1em;text-indent:0;white-space:pre;}label._log > input[type=checkbox]:checked ~ span{margin-left:2em;text-indent:-1em;}label._log > input[type=checkbox]:checked ~ span:first-of-type:before{content:'\\0025BC';}label._log > input[type=checkbox]:checked ~ span:before{content:'';}label._log,label._log > input[type=checkbox]:checked ~ ul{display:block;}label._log > span:first-of-type,label._log > input[type=checkbox]:checked ~ span{display:inline-block;}label._log > input[type=checkbox],label._log > input[type=checkbox]:checked ~ span > span{display:none;}";
var addedcss = false;
var cescapes = {
  '\0': '\\0', '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r',
  '\t': '\\t', '\v': '\\v', "'": "\\'", '"': '\\"', '\\': '\\\\'
};
var retrying = null;
var queue = [];
see = function see() {
  if (logconsole && typeof(logconsole.log) == 'function') {
    logconsole.log.apply(window.console, arguments);
  }
  var args = Array.prototype.slice.call(arguments);
  queue.push('<div class="_log">');
  while (args.length) {
    var obj = args.shift();
    if (vtype(obj) == 'String')  {
      // Logging a string just outputs the string without quotes.
      queue.push(htmlescape(obj));
    } else {
      queue.push(repr(obj, logdepth, queue));
    }
    if (args.length) { queue.push(' '); }
  }
  queue.push('</div>');
  flushqueue();
};

function loghtml(html) {
  queue.push('<div class="_log">');
  queue.push(html);
  queue.push('</div>');
  flushqueue();
}


function vtype(obj) {
  var bracketed = Object.prototype.toString.call(obj);
  var vt = bracketed.substring(8, bracketed.length - 1);
  if (vt == 'Object') {
    if ('length' in obj && 'slice' in obj && 'number' == typeof obj.length) {
      return 'Array';
    }
  }
  return vt;
}
function isprimitive(vt) {
  switch (vt) {
    case 'String':
    case 'Number':
    case 'Boolean':
    case 'Undefined':
    case 'Date':
    case 'RegExp':
    case 'Null':
      return true;
  }
  return false;
}
function isdom(obj) {
  return (obj.nodeType && obj.nodeName && typeof(obj.cloneNode) == 'function');
}
function midtruncate(s, maxlen) {
  if (maxlen && s.length > maxlen) {
    return s.substring(0, Math.floor(maxlen / 2)) + '...' +
        s.substring(s.length - Math.floor(maxlen / 2));
  }
  return s;
}
function cstring(s, maxlen) {
  s = midtruncate(s, maxlen);
  function cescape(c) {
    if (cescapes.hasOwnProperty(c)) {
      return cescapes[c];
    }
    var temp = '0' + c.charCodeAt(0).toString(16);
    return '\\x' + temp.substring(temp.length - 2);
  }
  if (s.indexOf('"') == -1 || s.indexOf('\'') != -1) {
    return '"' + htmlescape(s.replace(/[\0-\x1f\x7f-\x9f"\\]/g, cescape)) + '"';
  } else {
    return "'" + htmlescape(s.replace(/[\0-\x1f\x7f-\x9f'\\]/g, cescape)) + "'";
  }
}
function tiny(obj, maxlen) {
  var vt = vtype(obj);
  if (vt == 'String') { return cstring(obj, maxlen); }
  if (vt == 'Undefined' || vt == 'Null') { return vt.toLowerCase(); }
  if (isprimitive(vt)) { return '' + obj; }
  if (vt == 'Array' && obj.length === 0) { return '[]'; }
  if (vt == 'Object' && isshort(obj)) { return '{}'; }
  if (isdom(obj) && obj.nodeType == 1) {
    if (obj.hasAttribute('id')) {
      return '&lt;' + obj.tagName.toLowerCase() +
          ' id="' + htmlescape(obj.getAttribute('id')) + '"&gt;';
    } else {
      return '&lt;' + obj.tagName.toLowerCase() + '&gt;';
    }
  }
  return vt;
}
function isnonspace(dom) {
  return (dom.nodeType != 3 || /[^\s]/.exec(dom.textContent));
}
function trimemptystartline(s) {
  return s.replace(/^\s*\n/, '');
}
function isshort(obj, shallow, maxlen) {
  var vt = vtype(obj);
  if (isprimitive(vt)) { return true; }
  if (!shallow && vt == 'Array') { return !maxlen || obj.length <= maxlen; }
  if (isdom(obj)) {
    if (obj.nodeType == 9 || obj.nodeType == 11) return false;
    if (obj.nodeType == 1) {
      return (obj.firstChild === null ||
         obj.firstChild.nextSibling === null &&
         obj.firstChild.nodeType == 3 &&
         obj.firstChild.textContent.length <= maxlen);
    }
    return true;
  }
  if (vt == 'Function') {
    var sc = obj.toString();
    return (sc.length - sc.indexOf('{') <= maxlen);
  }
  if (vt == 'Error') {
    return !!obj.stack;
  }
  var count = 0;
  for (var prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      count += 1;
      if (shallow && !isprimitive(vtype(obj[prop]))) { return false; }
      if (maxlen && count > maxlen) { return false; }
    }
  }
  return true;
}
function domsummary(dom, maxlen) {
  if ('outerHTML' in dom) {
    var short = isshort(dom, maxlen);
    var html = dom.cloneNode(short).outerHTML;
    var tail = null;
    if (!short) {
      var m = /^(.*)(<\/[^\s]*>$)/.exec(html);
      if (m) {
        tail = m[2];
        html = m[1];
      }
    }
    return [htmlescape(html), tail && htmlescape(tail)];
  }
  if (dom.nodeType == 1) {
    var parts = ['<' + dom.tagName];
    var attrlen = 5 + Math.floor(maxlen /
        Math.max(5, Math.min(1, attributes.length)));
    for (var j = 0; j < dom.attributes.length; ++j) {
      parts.push(domsummary(dom.attributes[j], attrlen));
    }
    return [htmlescape(parts.join(' ') + '>'),
        !dom.firstChild ? null : '</' + dom.tagName + '>'];
  }
  if (dom.nodeType == 2) {
    return [htmlescape(dom.name + '="' +
        htmlescape(midtruncate(dom.value, maxlen), '"') + '"'), null];
  }
  if (dom.nodeType == 3) {
    return [htmlescape(trimemptystartline(dom.textContent)), null];
  }
  if (dom.nodeType == 4) {
    return ['<![CDATA[' + htmlescape(midtruncate(dom.textContent, maxlen)) +
        ']]>', null];
  }
  if (dom.nodeType == 8) {
    return ['<!--' + htmlescape(midtruncate(dom.textContent, maxlen)) +
        '-->', null];
  }
  if (dom.nodeType == 10) {
    return ['<!DOCTYPE ' + htmlescape(dom.nodeName) + '>', null];
  }
  return [dom.nodeName, null];
}
function summary(obj, maxlen) {
  var vt = vtype(obj);
  if (isprimitive(vt)) {
    return tiny(obj, maxlen);
  }
  if (isdom(obj)) {
    var ds = domsummary(obj, maxlen);
    return ds[0] + (ds[1] ? '...' + ds[1] : '');
  }
  if (vt == 'Function') {
    var ft = obj.toString();
    if (ft.length - ft.indexOf('{') > maxlen) {
      ft = ft.replace(/\{(?:.|\n)*$/, '').trim();
    }
    return ft;
  }
  if ((vt == 'Error' || vt == 'ErrorEvent') && 'message' in obj) {
    return obj.message;
  }
  var pieces = [];
  if (vt == 'Array' && obj.length < maxlen) {
    var identical = (obj.length > 1);
    var firstobj = identical && obj[0];
    for (var j = 0; j < obj.length; ++j) {
      if (identical && obj[j] !== firstobj) { identical = false; }
      pieces.push(tiny(obj[j], maxlen));
    }
    if (identical) {
      return '[' + tiny(firstobj, maxlen) + '] \xd7 ' + obj.length;
    }
    return '[' + pieces.join(', ') + ']';
  } else if (isshort(obj, false, maxlen)) {
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        pieces.push(quotekey(key) + ': ' + tiny(obj[key], maxlen));
      }
    }
    return (vt == 'Object' ? '{' : vt + '{') + pieces.join(', ') + '}';
  }
  if (vt == 'Array') { return 'Array(' + obj.length + ')'; }
  return vt;
}
function quotekey(k) {
  if (/^\w+$/.exec(k)) { return k; }
  return cstring(k);
}
function htmlescape(s, q) {
  var pat = /[<>&]/g;
  if (q) { pat = new RegExp('[<>&' + q + ']', 'g'); }
  return s.replace(pat, function(c) {
    return c == '<' ? '&lt;' : c == '>' ? '&gt;' : c == '&' ? '&amp;' :
           c == '"' ? '&quot;' : '&#' + c.charCodeAt(0) + ';';
  });
}
function unindented(s) {
  s = s.replace(/^\s*\n/, '');
  var leading = s.match(/^\s*\S/mg);
  var spaces = leading.length && leading[0].length - 1;
  var j = 1;
  // If the block begins with a {, ignore those spaces.
  if (leading.length > 1 && leading[0].trim() == '{') {
    spaces = leading[1].length - 1;
    j = 2;
  }
  for (; j < leading.length; ++j) {
    spaces = Math.min(leading[j].length - 1, spaces);
    if (spaces <= 0) { return s; }
  }
  var removal = new RegExp('^\\s{' + spaces + '}', 'mg');
  return s.replace(removal, '');
}
function expand(prefix, obj, depth, output) {
  output.push('<label class="_log"><input type="checkbox"><span>');
  if (prefix) { output.push(prefix); }
  if (isdom(obj)) {
    var ds = domsummary(obj, 10);
    output.push(ds[0]);
    output.push('</span><ul>');
    for (var node = obj.firstChild; node; node = node.nextSibling) {
      if (isnonspace(node)) {
        if (node.nodeType == 3) {
          output.push('<li><div>');
          output.push(unindented(node.textContent));
          output.push('</div></li>');
        } else if (isshort(node, true, 20) || depth <= 1) {
          output.push('<li>' + summary(node, 20) + '</li>');
        } else {
          expand('', node, depth - 1, output);
        }
      }
    }
    output.push('</ul>');
    if (ds[1]) {
      output.push('<span>');
      output.push(ds[1]);
      output.push('</span>');
    }
    output.push('</label>');
  } else {
    output.push(summary(obj, 10));
    output.push('</span><ul>');
    var vt = vtype(obj);
    if (vt == 'Function') {
      var ft = obj.toString();
      var m = /\{(?:.|\n)*$/.exec(ft);
      if (m) { ft = m[0]; }
      output.push('<li><div>');
      output.push(htmlescape(unindented(ft)));
      output.push('</div></li>');
    } else if (vt == 'Error') {
      output.push('<li><div>');
      output.push(htmlescape(obj.stack));
      output.push('</div></li>');
    } else if (vt == 'Array') {
      for (var j = 0; j < Math.min(100, obj.length); ++j) {
        try {
          val = obj[j];
        } catch(e) {
          val = e;
        }
        if (isshort(val, true, 20) || depth <= 1 || vtype(val) == 'global') {
          output.push('<li>' + j + ': ' + summary(val, 100) + '</li>');
        } else {
          expand(j + ': ', val, depth - 1, output);
        }
      }
      if (obj.length > 100) {
        output.push('<li>length=' + obj.length + ' ...</li>');
      }
    } else {
      var count = 0;
      for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
          count += 1;
          if (count > 100) { continue; }
          var val;
          try {
            val = obj[key];
          } catch(e) {
            val = e;
          }
          if (isshort(val, true, 20) || depth <= 1 || vtype(val) == 'global') {
            output.push('<li>');
            output.push(quotekey(key));
            output.push(': ');
            output.push(summary(val, 100));
            output.push('</li>');
          } else {
            expand(quotekey(key) + ': ', val, depth - 1, output);
          }
        }
      }
      if (count > 100) {
        output.push('<li>' + count + ' properties total...</li>');
      }
    }
    output.push('</ul></label>');
  }
}
function initlogcss() {
  if (!addedcss && !window.document.getElementById('_logcss')) {
    var style = window.document.createElement('style');
    style.id = '_logcss';
    style.innerHTML = (linestyle ? 'div._log{' +
        linestyle + '}' : '') + logcss;
    window.document.head.appendChild(style);
    addedcss = true;
  }
}
function repr(obj, depth, aoutput) {
  depth = depth || 3;
  var output = aoutput || [];
  var vt = vtype(obj);
  if (vt == 'Error' || vt == 'ErrorEvent') {
    output.push('<span style="color:red;">');
    expand('', obj, depth, output);
    output.push('</span>');
  } else if (isprimitive(vt)) {
    output.push(tiny(obj));
  } else if (isshort(obj, true, 100) || depth <= 0) {
    output.push(summary(obj, 100));
  } else {
    expand('', obj, depth, output);
  }
  if (!aoutput) {
    return output.join('');
  }
}
function aselement(s, def) {
  switch (typeof s) {
    case 'string':
      if (s == 'body') { return document.body; }
      if (document.querySelector) { return document.querySelector(s); }
      if ($) { return $(s)[0]; }
      return null;
    case 'undefined':
      return def;
    case 'boolean':
      if (s) { return def; }
      return null;
    default:
      return s;
  }
  return null;
}
function stickscroll() {
  var stick = false, a = aselement(autoscroll, null);
  if (a) {
    stick = a.scrollHeight - a.scrollTop - 10 <= a.clientHeight;
  }
  if (stick) {
    setTimeout(function() {
      a.scrollTop = a.scrollHeight - a.clientHeight;
    }, 0);
  }
}
function flushqueue() {
  var elt = aselement(logelement, null);
  if (elt && elt.appendChild && queue.length) {
    initlogcss();
    var temp = window.document.createElement('div');
    temp.innerHTML = queue.join('');
    queue.length = 0;
    stickscroll();
    while ((child = temp.firstChild)) {
      elt.appendChild(child);
    }
  }
  if (!retrying && queue.length) {
    retrying = setTimeout(function() { timer = null; flushqueue(); }, 100);
  } else if (retrying && !queue.length) {
    clearTimeout(retrying);
    retrying = null;
  }
}

// ---------------------------------------------------------------------
// TEST PANEL SUPPORT
// ---------------------------------------------------------------------
var addedpanel = false;
var inittesttimer = null;

function show(flag) {
  if (arguments.length === 0 || flag) {
    $('#_testpanel').show();
  } else {
    $('#_testpanel').hide();
  }
}
function promptcaret(color) {
  return '<div style="position:absolute;left:0;font-size:120%;color:' + color +
      ';">&gt;</div>';
}
function getSelectedText(){
    if(window.getSelection) { return window.getSelection().toString(); }
    else if(document.getSelection) { return document.getSelection(); }
    else if(document.selection) {
        return document.selection.createRange().text; }
}
function tryinitpanel() {
  if (!addedpanel) {
    if (!window.document.getElementById('_testlog') && window.document.body) {
      initlogcss();
      var titlehtml = (paneltitle ?
        '<div class="_log" style="color:gray;">' + paneltitle + '</div>' : '');
      $('body').prepend(
        '<div id="_testpanel" style="overflow-y:scroll;overflow-x:hidden;' +
            'position:fixed;bottom:0;left:0;width:100%;height:' + panelheight +
            'px;background:whitesmoke;font:10pt monospace;">' +
          '<div id="_testdrag" style="position:fixed;z-index:1;' +
              'cursor:row-resize;margin-top:-6px;height:6px;width:100%;' +
              'background:lightgray"></div>' +
          '<div id="_testlog">' + titlehtml + '</div>' +
          '<div style="position:relative;">' +
          promptcaret('blue') +
          '<input id="_testinput" class="_log" style="width:100%;' +
              'padding-left:1em;margin:0;border:0;font:inherit;">' +
        '</div>');
      addedpanel = true;
      var history = [];
      if (uselocalstorage) {
        try {
          history = window.JSON.parse(window.localStorage[uselocalstorage]);
        } catch (e) { }
      }
      flushqueue();
      var historyindex = 0;
      var historyedited = {};
      $('#_testinput').on('keydown', function(e) {
        if (e.which == 13) {
          // Handle the Enter key.
          var text = $(this).val();
          $(this).val('');
          // Save (nonempty, nonrepeated) commands to history and localStorage.
          if (text.trim().length &&
              (history.length === 0 || history[history.length - 1] != text)) {
            history.push(text);
            if (uselocalstorage) {
              try {
                window.localStorage[uselocalstorage] =
                    window.JSON.stringify(history);
              } catch (e) { }
            }
          }
          // Reset up/down history browse state.
          historyedited = {};
          historyindex = 0;
          // Copy the entered prompt into the log, with a grayed caret.
          loghtml('<div class="_log" style="margin-left:-1em;">' +
                  promptcaret('lightgray') +
                  htmlescape(text) + '</div>');
          $(this).select();
          // Deal with the ":scope" command
          if (text.trim().length && text.trim()[0] == ':') {
            var scopename = text.trim().substring(1).trim();
            if (!scopename || scopes.hasOwnProperty(scopename)) {
              currentscope = scopename;
              var desc = scopename ? 'scope ' + scopename : 'default scope';
              loghtml('<span style="color:blue">switched to ' + desc + '</span>');
            } else {
              loghtml('<span style="color:red">no scope ' + scopename + '</span>');
            }
            return;
          }
          // Actually execute the command and log the results (or error).
          var ef = evalfunction, et = evalthis;
          try {
            if (scopes.hasOwnProperty(currentscope)) {
              if (scopes[currentscope].e) { ef = scopes[currentscope].e; }
              if (scopes[currentscope].t) { et = scopes[currentscope].t; }
            }
            var result = ef.call(et, text);
            if ((typeof result) != 'undefined') {
              loghtml(repr(result));
            } else {
              stickscroll();
            }
          } catch (e) {
            see(e);
          }
        } else if (e.which == 38 || e.which == 40) {
          // Handle the up and down arrow keys.
          // Stow away edits in progress (without saving to history).
          historyedited[historyindex] = $(this).val();
          // Advance the history index up or down, pegged at the boundaries.
          historyindex += (e.which == 38 ? 1 : -1);
          historyindex = Math.max(0, Math.min(history.length, historyindex));
          // Show the remembered command at that slot.
          var newval = historyedited[historyindex] ||
              history[history.length - historyindex];
          if (typeof newval == 'undefined') { newval = ''; }
          $(this).val(newval);
        }
      });
      $('#_testdrag').on('mousedown', function(e) {
        var drag = this,
            dragsum = $('#_testpanel').height() + e.pageY,
            barheight = $('#_testdrag').height(),
            dragwhich = e.which,
            dragfunc;
        if (drag.setCapture) { drag.setCapture(true); }
        dragfunc = function dragresize(e) {
          if (e.type != 'blur' && e.which == dragwhich) {
            $('#_testpanel').height(Math.max(0,
                Math.min($(window).height() - barheight, dragsum - e.pageY)));
          }
          if (e.type == 'mouseup' || e.type == 'blur' ||
              e.type == 'mousemove' && e.which != dragwhich) {
            $(window).off('mousemove mouseup blur', dragfunc);
            if (document.releaseCapture) { document.releaseCapture(); }
          }
        }
        $(window).on('mousemove mouseup blur', dragfunc);
        return false;
      });
      $('#_testpanel').on('mouseup', function(e) {
        if (getSelectedText()) { return; }
        // Focus without scrolling.
        var scrollpos = $('#_testpanel').scrollTop();
        $('#_testinput').focus();
        $('#_testpanel').scrollTop(scrollpos);
      });
    }
  }
  if (inittesttimer && addedpanel) {
    clearTimeout(inittesttimer);
  } else if (!addedpanel && !inittesttimer) {
    inittesttimer = setTimeout(tryinitpanel, 100);
  }
}

exportsee();

})();