(function() {
  'use strict';

  var AsyncFormElementPrototype = Object.create(HTMLFormElement.prototype);

  Object.defineProperty(AsyncFormElementPrototype, 'asyncAccept', {
    get: function() {
      return this.getAttribute('async-accept') || '*/*';
    },
    set: function(value) {
      this.setAttribute('async-accept', value);
    }
  });

  Object.defineProperty(AsyncFormElementPrototype, 'asyncMethod', {
    get: function() {
      var method = this.getAttribute('method');
      if (method) {
        method = method.toLowerCase();
      }
      switch (method) {
        case 'get':
        case 'post':
        case 'put':
        case 'delete':
          return method;
      }
      return 'get';
    },
    set: function(value) {
      this.setAttribute('method', value);
    }
  });

  function makeDeferred() {
    var resolve, reject;
    var promise = new Promise(function(_resolve, _reject) {
      resolve = _resolve;
      reject = _reject;
    });
    return Object.defineProperties(promise, {
      resolve: { value: resolve },
      reject: { value: reject }
    });
  }

  function nextTick(fn) {
    Promise.resolve().then(fn);
  }

  function resolveDispatch(event) {
    if (event.defaultPrevented) {
      event.dispatched.reject(new Error('submit default action canceled'));
    } else {
      event.dispatched.resolve();
    }
  }

  function captureAsyncFormSubmit(event) {
    if (AsyncFormElementPrototype.isPrototypeOf(event.target)) {
      event.dispatched = makeDeferred();
      nextTick(function() {
        resolveDispatch(event);
      });

      event.submission = makeDeferred();

      window.removeEventListener('submit', handleAsyncFormSubmit, false);
      window.addEventListener('submit', handleAsyncFormSubmit, false);

      event.dispatched.then(function() {
        return event.target.request();
      }).then(event.submission.resolve, event.submission.reject);
    }
  }

  function handleAsyncFormSubmit(event) {
    resolveDispatch(event);

    // Always disable default form submit
    event.preventDefault();
  }

  window.addEventListener('submit', captureAsyncFormSubmit, true);


  AsyncFormElementPrototype.createdCallback = function() {
  };

  AsyncFormElementPrototype.asyncSubmit = function() {
    return this.request();
  };

  AsyncFormElementPrototype.serializeFormData = function() {
    return new FormData(this);
  };

  AsyncFormElementPrototype.serializeUrlEncoded = function() {
    var params = [];
    var i, els = this.elements;
    for (i = 0; i < els.length; i++) {
      params.push([els[i].name, els[i].value]);
    }

    var urlencoded = [];
    for (i = 0; i < params.length; i++) {
      urlencoded.push(encodeURIComponent(params[i][0]) +
        '=' +
        encodeURIComponent(params[i][1]));
    }
    return urlencoded.join('&');
  };

  AsyncFormElementPrototype.request = function() {
    var form = this;
    return new Promise(function(resolve, reject) {
      var req = new XMLHttpRequest();

      var method = form.asyncMethod;
      var url = form.action;
      if (method === 'get') {
        url += '?' + form.serializeUrlEncoded();
      }
      var body;

      req.open(method.toUpperCase(), url);
      req.setRequestHeader('Accept', form.asyncAccept);

      if (method !== 'get') {
        req.setRequestHeader('Content-Type', form.enctype);

        if (form.enctype === 'multipart/form-data') {
          body = form.serializeFormData();
        } else {
          body = form.serializeUrlEncoded();
        }
      }

      req.onload = function() {
        if (req.status === 200) {
          resolve(req.response);
        } else {
          reject(new Error(req.statusText));
        }
      };

      req.onerror = function() {
        reject(new Error('Network Error'));
      };

      req.send(body);
    });
  };

  window.AsyncFormElement = document.registerElement('async-form', {
    prototype: AsyncFormElementPrototype,
    'extends': 'form'
  });
})();
