// ==UserScript==
// @name        Desmos Graphing Calculator Tweaks
// @namespace   Desmos
// @description Graphing calculator tweaks
// @include     https://www.desmos.com/calculator
// @include     https://www.desmos.com/calculator/*
// @include     https://www.desmos.com/calculator?*
// @include     https://www.desmos.com/3d
// @include     https://www.desmos.com/3d/*
// @include     https://www.desmos.com/3d?*
// @run-at      document-idle
// @author      [AM]
// @version     20240325
// @grant       none
// ==/UserScript==

// Independant one-liners to save/load state from browser console, eg for manual crash recovery.
//  print to console:   console.log(JSON.stringify(Calc.getState()));
//  paste into console: Calc.setState(JSON.parse(PASTE_HERE));
//  save to file:   { const url = URL.createObjectURL(new Blob([JSON.stringify(Calc.getState())], {type: 'application/json'})); const a = document.createElement('a'); a.href = url; a.download = "desmos.json"; document.head.appendChild(a); a.click(); a.remove; URL.revokeObjectURL(url); } 
//  load from file: { const input = document.createElement('input'); input.type = 'file'; input.oninput = ev => { const fr = new FileReader(ev.target.files); fr.oninput = s => Calc.setString(JSON.parse(s)); fr.readAsText(ev.target.files[0])}; { listen(document, 'click', function () { document.removeEventListener('click', arguments.callee); input.click(); input.remove(); }); } }
//   (click anywhere on document to activate)

// Changelog
// 20240325
//  Error reporting and formatting.
// 20240324
//  Rework element injection to be repeatable and modular.
// 20240320 2024-07-20 18:54:03 -0500
//  Load on 3D graphing page.
// 20220725 2022-07-25 14:38:10.039454000 -05:00
//  Focus state paste box after one click, not two.
// 20220724
//   Add commented one-liners at the top of the script.
//   Fix typo in changelog.
// 20220703
//   Warn on invalid serialized state.
//   New app-side convenience function window.tweaks_api_call (k, v). It is UNSTABLE and likely to be moved/renamed.
// 20211124
//   Add *et_calc_urlstring methods and *eturlstate API calls.
// 20210522
//   Wait for Calc to exist before loading.
// 20200726
//   Git prep
//   Removed old body replacement attempt
// 20200510
//   url-too-long error autoreloads safely, and is a lot more verbose.
// 20200506
//   API span and handler
//   Convenience functions *et_calc_zipstring
//   Safely handle url too long (unfin)
// 2020212
//   Copy/paste calcstring buttons
// 20191203
//   Touch events work better. TODO: Better SaveAs, with filename prompt.
// 20191203
//   Actually tested on mobile view. Required a complete restructure to accomodate userscript extensions that don't implement @grant none, such as USI.
// 20191129
//   Mobile-friendly changes:
//     Move Load/Save buttons to the undo/redo bar.
// 20191127
//   Restore on load & keep url updated automatically
// 20191126
//   string -> function
//   utility functions
//   write compressed JSON to URL query when saving and loading

// TODO
// Beter SaveAs, with filename prompt. Popup? Invisible background click-off?
// Add update url

var DEBUG = false;

if (DEBUG)
    window.original_hash = location.hash;

tweaks = {
  maxTreeSize: 1e5,
  cloudfront_autoreload: true,
};

function timeout_until (func, delay) {
  return new Promise(function (resolve, reject) {
    (function callback () {
      try {
        var success = func();
      } catch (err) {
        reject(err);
      }
      if (success)
        resolve();
      else
        setTimeout(callback, delay);
    })();
  });
}

function listen (target, type, func, ...args) {
  target.addEventListener(type, (...args) => {
    try {
      return func(...args);
    } catch (err) {
      console.error(err);
    }
  }, ...args)
}

function listen_types (target, types, ...args) {
  for (const type of types) {
    listen(target, type, ...args);
  }
}

function loadTweaks () {
  var most_recent_JSON;
  var getState_proxy, setState_proxy;
  var api_elem;
  const eid = id => document.getElementById(id);
  const ecn = id => document.getElementsByClassName(id);
  const select = selector => document.querySelector(selector);
  function clickortouch (e, f) {
    listen(e, 'click', f, false);
    listen(e, 'touchend', f, false);
  }

  var _runPageScriptElement = null;
  function runPageScript (source) {
    try {
      _runPageScriptElement.innerHtml = source;
    } catch (err) {
      console.error(err);
    } finally {
      try {
        _runPageScriptElement.innerHtml = '';
      } finally {
      }
    }
  }
  
  function get_calc_string () {
    //;;console.log("<get_calc_string()>");
    //const s = JSON.stringify(Calc.getState());
    getState_proxy.click();
    const s = getState_proxy.innerText;
/*
    const S = Calc.getState();
    const s = JSON.stringify(S);
    //update_url(s);
*/
    //;;console.log("</get_calc_string()>");
    try {
        JSON.parse(s);
    } catch (e) {
        console.warn("produced json is unparsable", e);
    }
    return s;
  }
  function zip_test (original, zipped) {
    let unzipped;
    try {
        unzipped = unzip(zipped);
    } catch (e) {
        console.warn("zip produced erroneous output", e);
        return false;
    }
    if (unzipped != original) {
        console.warn("zip produced non-involutory output");
        return false;
    }
    return true;
  }
  function get_calc_zipstring () {
    const s = get_calc_string();
    const z = zip(s);
    zip_test(s, z);
    return r;
  }
  function get_calc_urlstring () {
    return encode(get_calc_zipstring());
  }
  function set_calc_string (json) {
    //Calc.setState(JSON.parse(json), {allowUndo: (function (a) { return a===undefined? true : a; })(tweaks.loadJSON_allowUndo)});
    setState_proxy.innerText = json;
    setState_proxy.click();
  }
  function set_calc_zipstring (payload) {
    set_calc_string(unzip(payload));
  }
  function set_calc_urlstring (payload) {
    set_calc_zipstring(decode(payload));
  }
  function update_url (s) {
    if (s === null) {
      var payload = null;
    } else {
      most_recent_JSON = s;
      var payload = zip(s).replace(/=/g, "");
    }
    //document.location.hash = payload;
    //history.replaceState(null, "", "/calculator"+"#"+payload);
    const query = new URLSearchParams(location.search);
    if (payload === null)
      query.delete('tweaks__calc_state')
    else
      query.set('tweaks__calc_state', payload);
    const loc = `${location.pathname}?${query.toString()}${location.hash}`;
    history.replaceState(null, "", loc);
    //console.log(`url set to ${loc}`);
  }
  function state_from_url () {
    match = location.search.match(/(?:[?&]tweaks__calc_state=)([^&]*)/);
    return match? unzip(decode(match[1])) : null;
    const query = new URLSearchParams(location.search);
    return unzip(query.get('tweaks__calc_state'));
  }

  const onLoadScripts = [
    'window.tweaks_api_call = function tweaks_api_call (k, v) { document.getElementById(\'tweaks-api\').setAttribute(k, v); }',
    'console.log(\'onload\'); Calc.observeEvent(\'change\', function () { document.getElementById(\'tweaks-json-helper-onChange\').click() });',
  ];
  function OnLoad () {
    //console.log("OnLoad()");
    if(location.pathname == "/calculator") {
      const saved = state_from_url();
      if (saved) {
        console.log(saved);
        set_calc_string(saved);
        console.log("Tweaks: Restored calc state from URL.");
      }
    }
    //Calc.observeEvent('change', function () { update_url(get_calc_string()); });
    for (const script of onLoadScripts) {
      runPageScript(script);
    }
  }
  
  function HandleCloudfrontError () {
    //console.log("HandleCloudfrontError()")
    const key = 'tweaks__bad_calc_state';
    if (document.title == "ERROR: The request could not be satisfied") {
      console.log("Handling Cloudfront error");
      const html = '<div id="tweaks-cloudfront-error-box" hidden>&nbsp;<h1>Tweaks: <span id="tweaks-cloudfront-error-summary"></span></h1><p><span id="tweaks-cloudfront-error-comment">Unknown error.</span></p></div>';
      const e = eid('tweaks-cloudfront-error-comment');
      const show = (msg1 = "", msg2 = "") => {
        eid('tweaks-cloudfront-error-summary').innerText = msg1;
        eid('tweaks-cloudfront-error-comment').innerText = msg2;
        eid('tweaks-cloudfront-error-box').hidden = false;
      };
      document.body.insertAdjacentHTML('beforeEnd', html);

      const fromURL = state_from_url();
      const fromStorage = sessionStorage.getItem(key);
      if (fromURL !== null) {
        if (fromStorage !== null) {
          if (fromURL == fromStorage) {
            show("Unknown", "URL calc state is already in sessionStorage: could be another error. Not autoreloading; delete URL state data to try again.");
          } else {
            show("Conflicting state data betwixt URL and sessionStorage.");
          }
        } else {
          // Only URL data
          const payload = zip(fromURL);
          sessionStorage.setItem(key, payload);
          if (sessionStorage.getItem(key) != payload) {
            show("Error storing URL state data into sessionStorage.");
          } else if (tweaks.cloudfront_autoreload) {
            show("URL probably too long. Trying to fix.");
            update_url(null);
            location.reload();
            // call Cleanup ASAP after page reload, to make sure the URL data isn't lost.
          } else {
            show("URL probably too long.", "Delete the URL state data and hit reload to try the fix.");
          }
        }
      } else {
        if (fromStorage !== null) {
          update_url(fromStorage);
          if (state_from_url() != fromStorage) {
            show("Error moving sessionStorage state data into URL.", "Found state data only in sessionStorage. Could not move to URL.");
          } else {
            show("Found state data only in sessionStorage.", "Moved to URL. Reload to try URL trick.");
            sessionStorage.removeItem(key);
          }
        } else {
          show("No saved calc state. Unknown error.");
        }
      }
      // `return true` /should/ just stop the GOOP timer from looping.
      return true;
    }
    return false;
  }
  function CleanupCloudfrontError () {
    //console.log("CleanupCloudfrontError()");
    // Call Cleanup ASAP after page reload, to make sure the URL data isn't lost.
    const saved = sessionStorage.getItem('tweaks__bad_calc_state');
    if (saved !== null) {
      const unzipped = unzip(saved);
      console.log(saved);
      console.log(unzipped);
      update_url(unzipped);

      if (state_from_url() != unzipped) {
        console.log("Tweaks: Error restoring URL after CloudFront error.");
      } else {
        console.log("Tweaks: Cloudfront error URL restoration successful");
        sessionStorage.removeItem('tweaks__bad_calc_state');
      }
    }
  }
  
  function TweaksAPICall (k, v) {
    switch (k.toLowerCase().replace(/_/g, "")) {
    case 'help': {
      console.log("api commands: getstate getzipstate setstate setzipstate");
    } break;
    case 'getstate':  {
      api_elem.innerText = get_calc_string();
    } break;
    case 'getzipstate': {
      api_elem.innerText = get_calc_zipstring();
    } break;
    case 'geturlstate': {
      api_elem.innerText = get_calc_urlstring();
    } break;
    case 'setstate': {
      set_calc_string(v);
    } break;
    case 'setzipstate': {
      set_calc_zipstring(v);
    } break;
    case 'seturlstate': {
      set_calc_urlstring(v);
    } break;
    default:
      console.log(`Tweaks: Bad API call: k=${k}, v=${v}`);
      break;
    }
  }

  //try {

  if (HandleCloudfrontError())
    return true;
  CleanupCloudfrontError();

  {
    // Icons from icons8.com: "download" and "upload"
    const icon_save  = "data:image/png;base64,"+"iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAAYElEQVQ4jWNgGOzgPyEFTJTaMDgNkMehFpc4ClBgYGB4ycDAYA/lwwLRASquQIwhNgwMDC8YGBicoAbYQDU7EaMZBuyhmv5DaQdSNGNzCdmAmxLNRAFGND7BpItFzwADADnZDmQvbGkTAAAAAElFTkSuQmCC";
    const icon_load  = "data:image/png;base64,"+"iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAAV0lEQVQ4jWNgoDHgpkSzDQMDw0sGBgYncjTbQzX/h9IOpNr8Amrzf1JdogBVbA/l/4fSDlBxBWIMkUdi/8chTjT4T0gBEzmmDi4DBh4wovEJhjoWPQMMAP6QD2INYA/nAAAAAElFTkSuQmCC";
    const icon_copy  = "data:image/png;base64,"+"iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAAXElEQVQ4jd2SzQrAIAyDP/YIvrKyZ169uNvwsGj9gcEChUJIGmhgE07AgNIYA5IyMCB0jgTgUmRxJpVpRgxe04waPPvhFEr8yCDj64EpMuFrYqw08nPLrZxJ8yFuJ3UvowhAfiMAAAAASUVORK5CYII";
    const icon_paste = "data:image/png;base64,"+"iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAAi0lEQVQ4jbWSUQqAIBBEn9EJukOnjP6ii2X36TODsp8ssxWlaEBw3dnRWRd+RANMQJtb0AMGsN6qg9gAXUzAANWxt0HOxRUw+wkVkFRQIHF9HmXkNSpy/kCRS3wrMHJvorOmJbLke40In9zfLXwWSP6GL7BwDVIKUr/oeI6ySAS2zIvQgqAFhlyBJHa/ICmusFqwdgAAAABJRU5ErkJggg";
    const elementDefinitions = [
      {
        'id': 'tweaks-buttons',
        'adjacency': 'beforeBegin',
        'parentSelector': '.dcg-center-buttons',
        'html': '<span id="tweaks-buttons"></span>',
        'children': [
          // =save=
          {
            'id': 'tweaks-json-saver',
            'html': '<button id="tweaks-json-saver" class="tweaks-json-button" onclick=""><img alt="Save JSON" src="'+icon_save+'"></img></button>',
            'children': [
              {
                'id': 'tweaks-json-save-link',
                'html': '<a id="tweaks-json-save-link" href="" target="_blank" download="desmos.json" hidden="true">Save JSON</img></a>',
                'setup': e => { // tweaks-json-save-link
                  const b = e.parentElement; // tweaks-json-saver
                  clickortouch(b, function (event) {
                    //console.log("clicked save");
                    const s = get_calc_string();
                    const l = URL.createObjectURL(new Blob([s], {type: 'application/json'}));
                    e.href = l;
                    e.download = tweaks.name || "desmos.json";
                    e.click();
                  });
                },
              },
            ]
          },

            // =load=
          {
            'id': 'tweaks-json-loader',
            'html': '<button id="tweaks-json-loader" class="tweaks-json-button" onclick=""><img alt="Load JSON" src="'+icon_load+'"></button>',
            'children': [
              {
                'id': 'tweaks-json-load-input',
                'html': '<input id="tweaks-json-load-input" onchange="" type="file" hidden="true">',
                'setup': e => { // tweaks-json-load-input
                  const b = e.parentElement; // tweaks-json-loader
                  clickortouch(b, function () {
                    //console.log("clicked load");
                    e.click();
                  });
                  listen(e, 'change', function (event) {
                    //console.log("clicked load");
                    const f = event.target.files[0], r = new FileReader();
                    r.onload = function(){
                      set_calc_string(r.result);
                      //update_url(r.result);
                      tweaks.filename = f.name;
                    };
                    r.readAsText(f);
                  }, false);
                },
              },
            ],
          },

          // =copy=
          {
            'id': 'tweaks-json-copier',
            'html': '<button id="tweaks-json-copier" class="tweaks-json-button" onclick=""><img alt="Save JSON" src="'+icon_copy+'"></img></button>',
            'setup': e => { // tweaks-json-copier
              clickortouch(e, function () {
                //console.log("clicked copy");
                const s = get_calc_string();
                navigator.clipboard.writeText(s);
              });
            },
          },

          // =paste=
          {
            'id': 'tweaks-json-paster',
            'html': '<button id="tweaks-json-paster" class="tweaks-json-button" onclick="" style="position:relative"><img alt="Load JSON" src="'+icon_paste+'"></button>',
            'children': [
              {
                'id': 'tweaks-json-paste-input',
                'html': '<input id="tweaks-json-paste-input" onchange="" type="text" style="position:absolute; width:100%; height:100%; left:0; top:0; opacity:0.25;">',
                'setup': e => { // tweaks-json-paste-input
                  const b = e.parentElement; // tweaks-json-paster
                  clickortouch(b, function () {
                    //console.log("clicked paste");
                    //navigator.clipboard.readText().then(function(data) {
                    //  set_calc_string(data);
                    //});
                    event.preventDefault();
                    e.hidden = false;
                    e.focus();
                  });
                  listen(e, 'input', function () {
                    console.log("pasted");
                    const data = event.target.value;
                    event.target.value = "";
                    const has_err = false
                    try {
                      set_calc_string(data);
                    } catch (err) {
                      has_err = true;
                      console.error(err);
                    }
                    if (!has_err) {
                      e.hidden = true;
                    }
                    //update_url(r.result);
                    //tweaks.filename = DEFAULT_FILENAME;
                  }, false);
                },
              },
            ]
          },

          // =sshot=
          // {
          //   'html': '<button id="screenshot-button" onclick="const g=function (n){return document.getElementById(n)},a=g(\'screenshot-link\'),w=g(\'screenshot-width\').value,h=g(\'screenshot-height\').value;a.href=Calc.screenshot({width:w,height:h]);a.hidden=false">Take Screenshot: </button>',
          //   'children': [
          //     {
          //       'html': '<input id="screenshot-width" class="screenshot-size-input" type="number" value="512"/>',
          //     }, {
          //       'html': '<input id="screenshot-height" class="screenshot-size-input" type="number" value="512"/>',
          //     }, {
          //       'html': '<a id="screenshot-link" href="" hidden="true">Link</a>',
          //       'setup': e => {
          //       }
          //     },
          //   ],
          //   //'&nbsp;',
          //   );
          // },

          // =helpers=
          {
            'id': 'tweaks-json-helper-getState',
            'html': '<button id="tweaks-json-helper-getState" hidden="true" onclick="this.innerText = JSON.stringify(Calc.getState());"></button>',
            'setup': e => {
              getState_proxy = eid('tweaks-json-helper-getState');
            },
          },
          {
            'id': 'tweaks-json-helper-setState',
            'html': '<button id="tweaks-json-helper-setState" hidden="true" onclick="Calc.setState(JSON.parse(this.innerText, {allowUndo: true}));"></button>',
            'setup': e => {
              setState_proxy = eid('tweaks-json-helper-setState');
            },
          },
          {
            'id': 'tweaks-json-helper-onChange',
            'html': '<button id="tweaks-json-helper-onChange" hidden="true" onclick=""></button>',
            'setup': e => { // tweaks-json-helper-onChange
              clickortouch(e, function () {
                update_url(get_calc_string());
                //console.log("updated");
              });
            },
          },
          {
            'id': 'tweaks-json-script-helper',
            'html': '<script id="tweaks-json-script-helper" type="text/javascript"></script>',
            'setup': e => { // tweaks-json-helper-script
              _runPageScriptElement = e;
            },
          },

          // =api observer=
          {
            'id': 'tweaks-api',
            'html': '<span id="tweaks-api"></span>',
            'setup': e => { // tweaks-api
              const o = e.observer = new MutationObserver(muts => {
                for (const mut of muts) {
                  //assert(mut.target === e);
                  //assert(mut.type == 'attributes');
                  const k = mut.attributeName;
                  const v = e.getAttribute(k);
                  if (v !== null) {
                    e.removeAttribute(k);
                    TweaksAPICall(k, v);
                  }
                }
              });
              o.observe(e, {'attributes': true, /*attributeFilter: [],*/});
            },
          },
        ],
      },
    ];
    function addElements () {
      const dummyParent = document.createElement('div');
      dummyParent.hidden = true;
      function addElement (definition, parent) {
        let allSucceeded = true;
        let e = eid(definition.id);
        if (!e) {
          // Inconveniently, insertAdjacentHTML doesn't return the created element.
          // Also inconveniently, setting outerHTML silently fails if e isn't in the canonical tree, not just if it has no parent, and completely replaces the outer element.
          // That leaves us with this, which (a) only creates one dummy element per page load, (b) keeps the dummy out of the DOM most of the time, (c) is non-destructive on siblings, and (d) doesn't draw anything incomplete.
          parent.insertAdjacentElement(definition.adjacency || 'beforeEnd', dummyParent);
          dummyParent.insertAdjacentHTML('beforeEnd', definition.html);
          e = dummyParent.lastElementChild;
          dummyParent.parentElement.replaceChild(e, dummyParent);

          const setup = definition.setup;
          if (setup) {
            setup(e);
          }
        }

        const children = definition.children;
        if (children) {
          for (const child_definition of children) {
            allSucceeded &&= !!addElement(child_definition, e);
          }
        }

        return allSucceeded;
      }
      function addRootElement (definition) {
        const parent = select(definition.parentSelector);
        return !!(parent && addElement(definition, parent));
      }

      let allSucceeded = true;

      for (const rootDefinition of elementDefinitions) {
        allSucceeded &&= !!addRootElement(rootDefinition);
      }

      if (allSucceeded) {
        console.log("GOOP");
      } else {
        console.log("EEK");
      }
      return allSucceeded;
    }
  }

  function waitForCalc () {
      return timeout_until(()=>window.Calc !== undefined, 100);
  }

  waitForCalc().then(
    () => timeout_until(addElements, 1000)
  ).then(
    () => {
      OnLoad();
      setInterval(addElements, 15000);
    }
  );
  //} catch () {}
}

loadTweaks();
  
 //==
 // https://stackoverflow.com/questions/3640357
 //==
 
  // Apply LZW-compression to a string and return base64 compressed string.
function zip (s) {
  try {
    var dict = {}
    var data = (s + '').split('')
    var out = []
    var currChar
    var phrase = data[0]
    var code = 256
    for (var i = 1; i < data.length; i++) {
      currChar = data[i]
      if (dict[phrase + currChar] != null) {
        phrase += currChar
      } else {
        out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0))
        dict[phrase + currChar] = code
        code++
        phrase = currChar
      }
    }
    out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0))
    for (var j = 0; j < out.length; j++) {
      out[j] = String.fromCharCode(out[j])
    }
    return utoa(out.join(''))
  } catch (e) {
    console.log('Failed to zip string return empty string', e)
    return ''
  }
}

// Decompress an LZW-encoded base64 string
function unzip (base64ZippedString) {
  try {
    var s = atou(base64ZippedString)
    var dict = {}
    var data = (s + '').split('')
    var currChar = data[0]
    var oldPhrase = currChar
    var out = [currChar]
    var code = 256
    var phrase
    for (var i = 1; i < data.length; i++) {
      var currCode = data[i].charCodeAt(0)
      if (currCode < 256) {
        phrase = data[i]
      } else {
        phrase = dict[currCode] ? dict[currCode] : oldPhrase + currChar
      }
      out.push(phrase)
      currChar = phrase.charAt(0)
      dict[code] = oldPhrase + currChar
      code++
      oldPhrase = phrase
    }
    return out.join('')
  } catch (e) {
    console.log('Failed to unzip string return empty string', e)
    return ''
  }
}

// ucs-2 string to base64 encoded ascii
function utoa (str) {
  return btoa(unescape(encodeURIComponent(str)))
}
// base64 encoded ascii to ucs-2 string
function atou (str) {
  return decodeURIComponent(escape(atob(str)))
}

function encode (s) {
  return encodeURIComponent(s);
}
function decode (s) {
  try {
    return decodeURIComponent(s);
  } catch (err) {
    return null;
  }
};

if (DEBUG) {
  window.update_url = update_url;
  window.state_from_url = state_from_url;
  window.get_calc_string = get_calc_string;
  window.get_calc_zipstring = get_calc_zipstring;
  window.set_calc_string = set_calc_string;
  window.set_calc_zipstring = set_calc_zipstring;
  window.zip = zip;
  window.unzip = unzip;
}


console.log("Tweaks loaded.");

