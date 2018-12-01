(function (win, doc) {

  var gc_params = win.gc_params || {};
  var extractor = new Extractor(win, doc);
  var amp = win.graphcomment_amp;

  // disable amp loader
  if (amp) {
    var css = '.i-amphtml-loader { display: none; }';
    var style = document.createElement('style');
    style.type = 'text/css';
    style.setAttribute('amp-custom', true);
    if (style.styleSheet){
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }
    var head = document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0];
    head.appendChild(style);
  }

  function lightOrDark(color) {
    var parsed;
    if ("transparent" === color) {
      parsed = { red: 0, green: 0, blue: 0 };
    }
    else if ("#" === color.charAt(0)) {
      parsed = {
        red: parseInt(color.substr(1,2), 16),
        green: parseInt(color.substr(3,2), 16),
        blue: parseInt(color.substr(5,2), 16),
      };
    }
    else if ("rgba(" === color.slice(0, 5) || "rgb(" === color.slice(0, 4)) {
      var colors = color.match(/\d+/g).map(Number);
      parsed = { red: colors[0], green: colors[1], blue: colors[1] };
    }
    var yiq = ((parsed.red * 299) + (parsed.green * 587) + (parsed.blue * 114)) / 1000;
    return (yiq >= 128) ? 'dark' : 'light';
  }

  function isElementInViewport(el) {
    var rect = el.getBoundingClientRect();
    var windowHeight = (window.innerHeight || document.documentElement.clientHeight);
    var windowWidth = (window.innerWidth || document.documentElement.clientWidth);
    var vertInView = (rect.top <= windowHeight) && ((rect.top + rect.height) >= 0);
    var horInView = (rect.left <= windowWidth) && ((rect.left + rect.width) >= 0);
    return (vertInView && horInView);
  }

  var url = gc_params.url || extractor.extractUrl();

  var params = {
    url: url,
    title: gc_params.page_title || extractor.extractTitle(),
    website_id: gc_params.graphcomment_id || win.graphcomment_id,
    uid: gc_params.uid,
    guid: gc_params.guid || gc_params.canonical_url,
    identifier: gc_params.identifier || extractor.extractIdentifier(url),
    category: gc_params.category,
    readonly: gc_params.readonly,
    inapp: win.graphcomment_inapp || false,
    publication_date: gc_params.publication_date,
    lifetime: gc_params.lifetime,
    theme: lightOrDark(getComputedStyle(document.body)['color']),
    sso_public_key: gc_params.sso_public_key,
    sso_data: gc_params.sso_data,
    facebook_redirect_after_login: gc_params.facebook_redirect_after_login,
    twitter_redirect_after_login: gc_params.twitter_redirect_after_login,
    google_redirect_after_login: gc_params.google_redirect_after_login
  };

  if (!params.website_id) {
    console.log('Graphcomment id missing');
    return;
  }

  var gc_domain = 'https://graphcomment.com';
  var front_url = gc_domain + '/front';

  if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
    gc_domain = 'http://localhost:9003';
    front_url = gc_domain;
  }

  if (win.GC_API_URL) {
    front_url = win.GC_API_URL;
  }

  var iframeBuilder = new IframeBuilder(win, doc, amp);
  var thread = doc.getElementById('graphcomment');
  thread.appendChild(iframeBuilder.getIframe());

  if (amp) {
    iframeBuilder.customAmpIframe(front_url, params);
  } else {
    iframeBuilder.customIframe(front_url, params);
  }

  iframeBuilder.postCreation();

  /**
   * IdentifierBuilder
   * @constructor
   */
  function IdentifierBuilder() {
    var origin = null;
    var value = null;

    this.init = function (anUrl) {
      origin = anUrl;
      value = origin;
      return this;
    };

    this.sanitize = function () {
      if (!value) return '';

      this.removeEndingSlash()
        .removeProtocol();

      return value;
    };

    this.reset = function () {
      value = origin;
    };

    this.removeEndingSlash = function () {
      value = value.replace(/\/+$/, "");
      return this;
    };

    this.removeProtocol = function () {
      value = value.replace(/^.*?:\/\//, '');
      return this;
    };
  }

  /**
   * Extractor
   * @param eWin The window
   * @constructor
   */
  function Extractor(eWin, eDoc) {
    var identifierBuilder = new IdentifierBuilder();

    this.extractTitle = function () {
      return eDoc.title;
    };

    this.ieCompatibility = function () {
      if (!eWin.location.origin) {
        eWin.location.origin = eWin.location.protocol + "//" + eWin.location.hostname +
          (eWin.location.port ? ':' + eWin.location.port : '');
      }
    };

    this.extractUrl = function () {
      this.ieCompatibility();
      var query_string = new QueryString();
      // add p= and page=
      return addParamsToUrl(eWin.location.origin + eWin.location.pathname, {
        p: query_string.p,
        page: query_string.page
      });

    };

    this.extractIdentifier = function (aUrl) {
      return identifierBuilder.init(aUrl).sanitize();
    };
  }

  function getBrowserLanguage() {
    var DEFAULT_LANGUAGE = 'en';
    var html = doc.querySelector('html');
    var meta = doc.querySelector('meta[name=language]') ||
      doc.querySelector('meta[http-equiv=content-language]');

    var language = html.getAttribute('lang') ||
      html.getAttribute('xml:lang') ||
      meta && meta.getAttribute('content') || DEFAULT_LANGUAGE;

    if (language.indexOf('-') !== -1 && /^[\w]{2}/.test(language)) {
      return language.slice(0, 2);
    } else if (/^[\w]{2}/.test(language)) {
      return language;
    } else {
      return DEFAULT_LANGUAGE;
    }
  }

  /**
   * IframeBuilder
   * @param eWin The Window
   * @param eDoc The Document
   * @param amp
   * @constructor
   */
  function IframeBuilder(eWin, eDoc, amp) {
    var IFRAME_ID = 'gc-iframe';
    var iframe = {};

    if(amp === true)
    {
      iframe = eDoc.createElement('amp-iframe');
    }
    else {
      iframe = eDoc.createElement('iframe');
    }

    iframe.id = IFRAME_ID;
    var query_string = new QueryString();
    var iframeWindow;

    win.addEventListener('message', function (event) {
      try {
        var data = typeof event.data === 'object' ? event.data : JSON.parse(event.data);

        if (data.height && data.graphcommentSource) {
          // Iframe auto-resize
          iframe.height = data.height;
        }

        else if (data.scrollTo) {
          // Scroll parent
          scrollParent(iframe, data.scrollTo);
        }

        else if (data['gc-loaded']) {
          // detect if user has scrolled until GC
          var wasInViewPort;
          var interval = setInterval(function() {
            var inViewport = isElementInViewport(iframeBuilder.getIframe());
            if (inViewport && wasInViewPort) {
              iframeWindow.postMessage(JSON.stringify({ info: 'in_viewport' }), '*');
              clearInterval(interval);
            }
            wasInViewPort = inViewport;
          }, 1000);
        }

      } catch (e) {}
    }, false);

    win.gcSsoLogout = function() {
      iframeWindow.postMessage(JSON.stringify({ info: 'sso-logout' }), '*');
    };

    win.gcSsoLogin = function(ssoData) {
      iframeWindow.postMessage(JSON.stringify({ info: 'sso-login', data: ssoData }), '*');
    };

    this.postCreation = function () {
      var iframeFound = eDoc.getElementById(IFRAME_ID);
      iframeWindow = (iframeFound.contentWindow || iframeFound.contentDocument);
      window.iframeFound = iframeFound;

      function postMessageParentLoaded() {
        if (amp) return
        iframeWindow.postMessage(JSON.stringify({ info: 'parent_loaded' }), '*');
      }

      if (eDoc.readyState === 'complete') {
        postMessageParentLoaded();
      } else {
        eDoc.addEventListener('DOMContentLoaded', postMessageParentLoaded());
      }

      win.addEventListener('message', function (event) {
        var data = {};
        var frameElementTop = 0;
        if (event.origin !== gc_domain)
          return;

        try {
          data = JSON.parse(event.data);
          frameElementTop = - iframeFound.getBoundingClientRect().top;
        } catch (e) {
          return;
        }

        if (!data) return;

        if (data.info === 'getFrameElementTop') {
          event.source.postMessage(JSON.stringify({info: 'frameElementTop', top: frameElementTop}), event.origin);
        }

        if (data.info === 'sso-auth') {
          if (!window.gcSsoAuth || typeof window.gcSsoAuth !== 'function') {
            throw new Error('you need to define gcSsoAuth() to provide a way to authenticate your user.');
          }

          window.gcSsoAuth();
        }
      }, false);

      win.addEventListener('scroll', debounce(function() {
        iframeWindow.postMessage(JSON.stringify({ info: 'scroll' }), '*');
      }, 1000, true), false);
    };

    this.getIframe = function () {
      return iframe;
    };

    this.customIframe = function (front_url, iframe_params) {
      iframe.src = this.createIframeUrl(front_url, iframe_params);
      iframe.frameBorder = '0';
      iframe.style.cssText = 'width:100% !important; border:none !important';
      iframe.scrolling = 'no';
      iframe.horizontalscrolling = 'no';
      iframe.verticalscrolling = 'no';
      iframe.allowtransparency = 'true';
      iframe.height = '400px';
    };

    this.customAmpIframe = function (front_url, iframe_params) {
      iframe.setAttribute('src', this.createIframeUrl(front_url, iframe_params));
      iframe.setAttribute('width', '600');
      iframe.setAttribute('height', '400');
      iframe.setAttribute('layout', 'responsive');
      iframe.setAttribute('title', iframe_params.title);
      iframe.setAttribute('sandbox',  'allow-scripts allow-same-origin allow-modals allow-popups allow-popups-to-escape-sandbox allow-top-navigation allow-forms');
      iframe.setAttribute('resizable', '');
      iframe.setAttribute('frameBorder', '0');
      iframe.insertAdjacentHTML('beforeend', '<div overflow tabindex=0 role=button aria-label="">Read more...</div>');
    };

    this.createIframeUrl = function (front_url, iframe_params) {
      var created_url = front_url + '/';

      // add them anyway, they won't be added if the comment_id is absent
      iframe_params.comment_id = query_string.comment_id;
      iframe_params.lang = getBrowserLanguage();

      // add all the parameters in the query
      created_url = addParamsToUrl(created_url, iframe_params);

      return created_url;
    };
  }

  /**
   * QueryString
   * @returns {*}
   * @constructor
   */
  function QueryString() {
    var query = win.location.search.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
      var pair = vars[i].split('=');
      // If first entry with this name
      if (typeof this[pair[0]] === 'undefined') {
        this[pair[0]] = pair[1];
        // If second entry with this name
      } else if (typeof this[pair[0]] === 'string') {
        this[pair[0]] = [this[pair[0]], pair[1]];
        // If third or later entry with this name
      } else {
        this[pair[0]].push(pair[1]);
      }
    }
  }

  function addParamsToUrl(created_url, url_params) {
    var appender = '?';

    // add all the parameters in the query
    Object.keys((url_params || {})).forEach(function (paramKey) {
      if (!url_params.hasOwnProperty(paramKey) || !url_params[paramKey]) {
        return; // skip this param if undefined, null or empty
      }
      created_url = created_url + appender + paramKey + '=' + encodeURIComponent(url_params[paramKey]);

      if (appender === '?') {
        appender = '&';
      }
    });

    return created_url;
  }

  function scrollParent(iframe, insideIFrameTop) {
    var from = win.pageYOffset || 0;
    var parentTarget = getTargetPosition();
    var t;
    var t0 = Date.now();
    var duration = 800;

    requestAnimationFrame(step);

    function step() {
      t = Date.now() - t0;
      t = t > duration ? duration : t;

      win.scrollTo(0, easeOutQuart(t, from, parentTarget - from, duration));

      if (t < duration) {
        requestAnimationFrame(step);
      }
    }

    function getTargetPosition() {
      return iframe.getBoundingClientRect().top + (win.pageYOffset || 0) + insideIFrameTop;
    }

  }

  function easeOutQuart(t, b, c, d) {
    return -c * ((t = t / d - 1) * t * t * t - 1) + b;
  }

  var requestAnimationFrame = win.requestAnimationFrame || function (callback) {
    return setTimeout(function () {
      callback();
    }, 1000 / 60);
  };

  function debounce(func, wait, immediate) {
    var timeout;
    return function() {
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  };

})(window, window.document);
