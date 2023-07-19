// Return object size properly (I don't remember why I added this/where I planned on using this)
Object.size = function (obj) {
  var
    size = 0,
    key;

  for (key in obj) {
    if (obj.hasOwnProperty(key)) size++;
  }

  return size;
};

// Polyfill for Array filter
if (!Array.prototype.filter) {
  Array.prototype.filter = function(fun /*, thisp */) {
    "use strict";

    if (this == null)
      throw new TypeError();

    var t = Object(this);
    var len = t.length >>> 0;
    if (typeof fun != "function")
      throw new TypeError();

    var res = [];
    var thisp = arguments[1];
    for (var i = 0; i < len; i++) {
      if (i in t) {
        var val = t[i]; // in case fun mutates this
        if (fun.call(thisp, val, i, t))
          res.push(val);
      }
    }

    return res;
  };
}

// Polyfill for String trim
if (typeof String.prototype.trim !== 'function') {
  String.prototype.trim = function () {
    return this.replace(/^\s+|\s+$/g, '');
  }
}

// Return only unique items in array
// This has been removed as of 20160902 due to causing numerous unrelated
// errors including CORS errors.
/* Array.prototype.getUnique = function () {
  var
    u = {},
    a = [];

  for (var i = 0, l = this.length; i < l; ++i) {
    if (this[i] in u)
      continue;
    a.push(this[i]);
    u[this[i]] = 1;
  }

  return a;
}; */

// Better log function to use for debugging
window.log = function () {
  log.history = log.history || [];   // store logs to an array for reference
  log.history.push(arguments);
  if (this.console) {
    console.log(Array.prototype.slice.call(arguments));
  }
};
