(function() {
  loadscript(
    '//raw.github.com/davidbau/see/master/see.js',
    function() {
      see.init();
  });
  function loadscript(src, callback) {
    function setonload(script, fn) {
      script.onload = script.onreadystatechange = fn;
    }
    var script = document.createElement("script"),
       head = document.getElementsByTagName("head")[0],
       pending = 1;
    setonload(script, function() {
      pending &&
      (!script.readyState || {loaded:1,complete:1}[script.readyState]) &&
      (pending = 0, callback(), setonload(script, null), head.removeChild(script));
    });
    script.src = src;
    head.appendChild(script);
  }
})();