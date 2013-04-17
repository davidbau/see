see
===

see.js: A simple interactive eval tool for Javascript.

The see.js interactive eval panel can be used to inspect
variable state within nested scopes, such as closures and
other nested functions.  It provides a friendly in-page
logging facility with tree view inspection of objects; and
it is friendly to both JavaScript and CoffeeScript.

Overview
--------

See can be used to debug a nested scope by making a call to
eval(see.scope('myscope')); within the scope of interest.
For example, the following nicely encapsulated code would normally
be difficult to debug without the added see lines:

<pre>
see.init();
(function() {
  eval(see.scope('wrap'));
  var private_var = 0;
  function myclosuremaker() {
    eval(see.scope('inner'));
    var counter = 0;
    return function() { ++counter; }
  }
  var inc = myclosuremaker();
})();
</pre>

To switch scopes within the interactive panel, just enter ":" followed
by the scope name, for example, ":inner", or ":wrap" in the example above.

An eval function passed to init will be used for the default scope (":").

Here it how to initialize see to interpret CoffeeScript at the current scope:

<pre>
see.init(eval(see.cs))
</pre>

The see package can also be used for normal logging, similar to
console.log, but producing output within the document itself.  Calling
see as a function will log a tree representation of the arguments.
The logged objects will be traversed to a fixed depth (default 5) at
the moment they are logged, instead of later when you expand the tree.

Detailed usage
--------------

<pre>
see.init();               // Creates the interactive panel.
see.init({height: 30, title: 'test panel'});   // Sets some options.
eval(see.init());         // Sets the default scope to local scope.
see.loghtml();            // Logs HTML without escaping.
r = see.repr(a, 3);       // Builds a tree representation of a to depth 3.
see.noconflict();         // Restores window.see to its old value.
eval(see.scope('name'));  // Type ":name" in the panel to use this scope. 
see(a, b, c);             // Logs values into the panel.
</pre>

Options to pass to init
-----------------------
<table>
<tr><td>eval</td><td>The default function (or closure) to use to evaluate expressions.</td></tr>
<tr><td>this</td><td>The object to use as "this" within the evaluation.</td></tr>
<tr><td>depth</td><td>The depth to which to traverse logged and evaluated objects.</td></tr>
<tr><td>height</td><td>The pixel height of the interactive panel.</td></tr>
<tr><td>title</td><td>A title shown at the top of the panel.</td></tr>
<tr><td>panel</td><td>false if no interactive panel is desired.</td></tr>
<tr><td>console</td><td>set to window.console to echo logging to the console also.</td></tr>
<tr><td>history</td><td>set to false to disable localStorage use for interactive history.</td></tr>
<tr><td>linestyle</td><td>css style for a single log line.</td></tr>
<tr><td>element</td><td>(if panel is false) - the element into which to logging is done.</td></tr>
<tr><td>autoscroll</td><td>(if panel is false) - the element to autoscroll to bottom.</td></tr>
<tr><td>jQuery</td><td>the page's local copy of jQuery to reuse.</td></tr>
<tr><td>coffee</td><td>the CoffeeScript compiler object, for coffeescript support.</td></tr>
</table>

Some implementation notes on interactions
-----------------------------------------

When see.init() is called, a private (noconflict) copy of jQuery is
loaded if jQuery is not already present on the page (unless the 'panel'
option is false, or the 'jQuery' option is explicity supplied).

Every expression entered in the panel is stored to '_loghistory' in
localStorage unless the 'history' option is set to false.
