see
===

see.js: See and debug local variables.

The see.js debugger can be used to inspect and change local variable
state when you are not stopped at a breakpoint.  This is a good solution
for debugging code wrapped in a top-level anonymous closure or for
debugging more complicated uses of closures.  The see.js debugger
also provides simple in-page logging with tree view inspection of
objects; and it provides support for debugging using CoffeeScript.


Overview
--------

Any local scope can be debugged by calling eval(see.here)
within the scope of interest.  For example, the following nicely
encapsulated code would normally be painful to debug without the
added see line:

<pre>
(function() {
  var private_var = 0;
  function myclosuremaker() {
    <b>eval(see.here);</b>  // Debug variables visible in this scope.
    var counter = 0;
    return function() { ++counter; }
  }
  var inc = myclosuremaker();
  inc();
})();
</pre>

When eval(see.here) is called, the see debugger is shown at the
bottom of the page, an en eval hook is set up within the current scope.

The debugging panel works like the Firebug or Chrome debugger
console, except that it uses the eval hook to give visibility into
local variable scope.  In this example, "counter" and "private_var"
and "inc" and "myclosuremaker" will all be visible symbols that
can be used and manipulated in the debugger.


Debugging multiple scopes
-------------------------

It is possible to attach to multiple scopes with a single program
by adding the following at the scope of interest:

<pre>
eval(see.scope('scopename'));
</pre>

To switch scopes within the interactive panel, just enter ":" followed
by the scope name, for example, ":scopename".  ":top" goes to global
scope, and ":" goes back to the default scope defined at init.

![Screenshot of see panel](see-usage.png?raw=true)


Bookmarklet
-----------

This URL can be used as a bookmarklet that loads see.js on any page.

<pre>
javascript:%28function%28%29{function%20a%28a,b%29{function%20c%28a,b%29{a.onload=a.onreadystatechange=b}var%20d=document.createElement%28%22script%22%29,e=document.getElementsByTagName%28%22head%22%29[0],f=1;c%28d,function%28%29{f&&%28!d.readyState||{loaded%3A1,complete%3A1}[d.readyState]%29&&%28f=0,b%28%29,c%28d,null%29,e.removeChild%28d%29%29}%29,d.src=a,e.appendChild%28d%29}a%28%22//raw.github.com/davidbau/see/master/see.js%22,function%28%29{see.init%28%29}%29}%29%28%29)
</pre>

When you are using the bookmarklet, eval(see.here) calls
may not be present in the code, but it is possible to insert the
see eval loop by evaluating using your regular (Chrome or Firebug)
debugger to run eval(see.here) when at a breakpoint in the scope
of interest.


CoffeeScript
------------

The see.js script originally started as a teaching tool in a
CoffeeScript environment, so it also supports use of CoffeeScript
as the console language.  Here it how to initialize see.js to
interpret code entered in the panel as CoffeeScript instead of
Javascript:

<pre>
see.init(eval(see.cs))
</pre>


Logging
-------

The top-level see function logs output to the see panel.  Logged
objects are shown in a tree view of the object state at the
moment when the object is logged.

<pre>
see(a, b, c);
</pre>


Using the regular debugger
--------------------------

To inspect an object visible to see in the regular debugger, just
use see.eval('mylocal'), which evaluates the expression in the scope
of interest and returns the value.  To focus on a different named
scope, use the two-argument form, see.eval('scopename', 'myexpression').



More examples of usage
----------------------

<pre>
see.init();               // Creates the interactive panel with global scope.
see.init({height: 30, title: 'test panel'});   // Sets some options.
eval(see.init());         // Does the same thing as eval(see.here).
eval(see.scope('name'));  // Type ":name" in the panel to use this scope.
see(a, b, c);             // Logs values into the panel.
see.loghtml('&lt;b>ok&lt;/b>'); // Logs HTML without escaping.
r = see.repr(a, 3);       // Builds a tree representation of a to depth 3.
x = see.noconflict();     // Relinguishes use of the 'see' name; use 'x'.
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
<tr><td>console</td><td>Set to window.console to echo logging to the console also.</td></tr>
<tr><td>history</td><td>Set to false to disable localStorage use for interactive history.</td></tr>
<tr><td>linestyle</td><td>CSS style for a single log line.</td></tr>
<tr><td>element</td><td>(if panel is false) - The element into which to logging is done.</td></tr>
<tr><td>autoscroll</td><td>(if panel is false) - The element to autoscroll to bottom.</td></tr>
<tr><td>jQuery</td><td>A local copy of jQuery to reuse instead of loading one.</td></tr>
<tr><td>coffee</td><td>The CoffeeScript compiler object, for coffeescript support.</td></tr>
<tr><td>noconflict</td><td>Name to use instead of "see".</td></tr>
</table>


Implementation notes
--------------------

If eval(see.init()) or eval(see.scope('name')) is called multiple
times for the same name, the scope is reset to the last scope set.
If multiple closures are created at the same line of code, that means that
you will only see the last one.  You can generate a name using
eval(see.scope('name' + index)) if you want to preserve visibility
into many scopes.

When see.init() is called, a private (noconflict) copy of jQuery is
loaded if window.jQuery is not already present on the page (unless
the 'panel' option is false, or the 'jQuery' option is explicity
supplied to init).

Every expression entered in the panel is stored to '_loghistory' in
localStorage unless the 'history' option set to a different key name, or
set to false to disable history persistence.
