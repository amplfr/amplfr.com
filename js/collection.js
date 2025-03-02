/**
 * Data fields needed to build an AmplfrCollection
 * @typedef {object} CollectionSourceData
 * @property {string} url - Canonical URL for the collection
 * @property {string} title - Title of the collection
 * @property {AmplfrItem[]|string[]} items - In order list of items that make up the collection. Each item can be an ItemElement object, URL, AmplfrID, or other supported identifier.
 * @property {string} [artwork] - URL for artwork
 */
/**
 * AmplfrCollection is an HTML element comprised of a list of {@link AmplfrItem}s.
 * The overriding methods (e.g. {@link AmplfrCollection#play}) mostly all operate on the currently selected item, whereas methods like {@link AmplfrCollection#item} (or AmplfrCollection.item = N) sets the currently selected Item.
 * @name AmplfrCollection
 * @see {@link AmplfrItem}
 * @class
 * @extends {AmplfrItem}
 * 
 * Displayed the same as AmplfrItem if only one Item is listed, but as a list otherwise
 */
class AmplfrCollection extends AmplfrItem {
  // #useShadow = false; // toggle if resulting elements should go in shadow DOM instead
  _data; // holds internal data object
  _options;
  static #parseAmplfrFn

  /**
   * @param {CollectionSourceData|ItemSourceData[]|string|string[]|null} data Source URL(s), data object(s) used to populate this. Can be one of the following:
   *  - CollectionSourceData object
   *  - ItemSourceData[] - list of ItemSourceData objects
   *  - string - Collection URL
   *  - string[] - list of item URLs, either an array or string of whitespace-separated URLs.
   *  - NULL - will use the element's dataset (as CollectionSourceData) or src (as URL to parse) attributes.
   * @param {Object} [options=true]
   * @param {HTMLOListElement} [options.ol] Existing HTML OL element to populate with list of items
   * @param {HTMLElement} [options.playing] Existing HTML element to populate with playing item
   */
  constructor(data, options = true) {
    super(false); // Always call super first in constructor

    this._data = {};
    this._options = {};

    this._options.useShadow = false; // toggle if resulting elements should go in shadow DOM instead
    this._options.preloadCount = 2; // navigator.hardwareConcurrency || 2; // max number of items to preload
    this._options.observer // 

    if (options.controls != null) this._options.controls = options?.controls;
    if (options.media != null) this._options.media = options?.media || options;
    if (options.played != null) this._options.played = options?.played || options;
    if (options == false) {
      this._options.controls = false
      this._options.media = false
      this._options.played = false
    } else {
      if (options.ol != null) this._options.ol = options.ol;  // to use existing HTML OL element for items
      if (options.playing != null) this._options.playing = options.playing;  // to use existing HTML element for playing
      if (options.played != null) this._options.played = options.played;  // to use existing HTML element for played
    }

    // only if this object is an AmplfrCollection vs some extended class
    if (this instanceof AmplfrCollection) {
      if (!!AmplfrItem && AmplfrItem.isValidID(data)) // single AmplfrID
        data = [data]

      if (typeof data == "string") {
        // if data has any whitespace characters (a URL should not)
        //  then split on each whitespace character and save each token as an item
        if (/\s/.test(data))
          this._data.items = data.split(/\s/);
        else if (AmplfrCollection.isValidID(data)) {
          // use a URL that points to the API endpoint for the AmplfrID
          this._options.src = document.location.origin + `/api/${data}.json`;
          this._data = AmplfrCollection.parseAmplfr(this.src); // parse url as a Amplfr URL, saving the promise
        }
        // if data is a string, hopefully it's a URL (under 2083 characters) with additional data
        else if (data.length <= 2083) {
          this._data = AmplfrCollection.parse(data); // fetch the URL, saving the promise
        }
      } else
        this._populate(data);
    }
  }

  static async parseAmplfr(url) {
    if (!AmplfrCollection.#parseAmplfrFn) {
      let { parseAmplfr } = await import('./parseAmplfr.js')
      AmplfrCollection.#parseAmplfrFn = parseAmplfr
    }

    return AmplfrCollection.#parseAmplfrFn(url)
  }

  static isValidID(text) {
    return typeof text == "string" &&
      /[0-9A-Za-z]{1,25}\/[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{22}/.test(text)
  }
  /**
   * Fetches the given URL, parses the received media file, and returns an object with the extracted metadata.
   * The return object can be used as input for _populate().
   * @param {string} [url] The URL endpoint/file to fetch and parse.
   * @returns {CollectionSourceData}
   */
  static async parse(url) {
    if (!url && !!this.src)
      url = this.src; // use src

    let obj = {}
    if (!!url && typeof url != 'string' && Object.keys(url).length > 0)
      obj = url // if url is an object, just return it

    let urlObj;
    try {
      // if url is actually a URL, then fetch(url) and save the results
      urlObj = new URL(url);
    } catch (error) {
      // url isn't a URL
      urlObj = null;
    }

    let text = url;
    try {
      if (!!urlObj) {
        // if urlObj isn't null then url is a URL
        const response = await fetch(url);
        const mime = response.headers.get("Content-Type");

        if (response.ok && !!response.body) {
          // if response is JSON, just return response as JSON
          if (mime === "application/json")
            // return await response.json();
            obj = await response.json();
          else {
            // response *isn't* JSON, so need to massage it to a CollectionSourceData object
            text = await response.text(); // get the raw text
            switch (mime) {
              // M3U or M3U8 playlist file
              case "application/mpegurl":
              case "application/x-mpegurl":
              case "audio/mpegurl":
              case "audio/x-mpegurl":
              case "application/vnd.apple.mpegurl": // non-standard
              case "application/vnd.apple.mpegurl.audio": // non-standard
                // return AmplfrCollection._parseM3U(urlObj, text);
                obj = AmplfrCollection._parseM3U(urlObj, text);
                break;

              default: // split by whitespace into separate items
                break;
            }
          }
        }
      }
      else {
        obj.items = text.split(/\s/);
      }
    } catch (error) {
      console.warn(error.messsage || error)
    }
    // obj = {};

    // if ()

    return obj;
  }
  /**
   * Parses M3U (or M3U8) text and extracts the needed data to build the object
   * @param {URL|string} urlObj The URL used as base URL for any relative URLs. Removes any text after the last '/' for the base path.
   * @param {string} text The raw M3U (M3U8) text
   * @returns {CollectionSourceData}
   */
  static _parseM3U(urlObj, text) {
    const lines = text.split(/\n|\r\n/); // break text into separate lines
    let obj;

    // confirm that the first line has the required string "#EXTM3U"
    if (!lines[0].test(/^#EXTM3U/i))
      return null;
    lines.shift(); // remove the first line

    urlObj = urlObj.toString();
    let baseUrl = urlObj.substring(0, urlObj.lastIndexOf("/")) + "/";

    let line;
    obj.items = [];
    for (n = 0; n < lines.length; n++) {
      line = lines[n];
      if (line.test(/^\s*$/))
        continue; // skip any "blank" lines

      // based on https://en.wikipedia.org/wiki/M3U#File_format
      if (line.test(/^#EXTINF:/i)) {
        // individual item
        // #EXTINF:123,Artist Name – Track Title␤
        // artist - title.mp3;
        let comma = line.indexOf(",", 9);
        const seconds = line.substring(9, comma >= 0 ? comma : undefined);
        const title = line.substring(comma >= 0 ? comma : 0);
        let location = lines[++n]; // shift to (and 'consume') the next line for the location

        // ensure location is an absolute URL
        if (!location.indexOf("://"))
          try {
            location = new URL(location, baseUrl);
          } catch (error) { }

        // append this item to obj.items
        obj.items.push({
          title,
          duration: seconds,
          url: location,
        });
      } else if (line.test(/^PLAYLIST:/i))
        obj.title = line.substring(10); // save the given playlist title
      else if (line.test(/^EXTART:/i))
        obj.artists = line.substring(8); // save the artist name(s)
      else if (line.test(/^EXTIMG:/i)) {
        // save the artist name(s)
        obj.artwork = line.substring(8);

        // ensure obj.artwork is an absolute URL
        if (!obj.artwork.indexOf("://"))
          try {
            obj.artwork = new URL(obj.artwork, baseUrl);
          } catch (error) { }
      }
    }

    return obj;
  }

  /**
   *
   */
  async _populate(source) {
    if (!!this._data) {
      // was this._parse(URL) called in the constructor?
      if (this._data.then) {
        source = await this._data; // await for the Promise to resolve
        this._data = {}; // reset _data object
      } else if (Array.isArray(this._data) && this._data[0].then) {
        // await for all of the Promises to resolve
        source = await Promise.allSettled(this._data);
        source = source.map((x) => x.value);
        this._data = {}; // reset _data object
      }
    }

    // check if there's enough data already provided
    if (!source) {
      if (Object.keys(this.dataset).length > 1)
        source = this.dataset; // use dataset
      else if (!!this.src)
        source = this.src; // use src
      else
        return; // nothing else to do here
    } else if (typeof source == "boolean") return

    // if obj is a string, hopefully it's a URL (under 2083 characters) with additional data
    if (typeof source == "string" && source.length <= 2083) {
      let url = source;
      source = await AmplfrCollection.parse(url);
    }

    // pull out all of the "string" keys from obj, saving to this.dataset
    const keys = ["id", "url", "title", "artwork"];
    keys.forEach((k) => {
      if (!!source[k] && typeof source[k] == "string")
        this._data[k] = source[k];
    });

    if (!!this._data?.title)
      this.title = this._data.title;

    if (source.items && source.items.length > 0)
      this._data.items = source.items;
    else if (Array.isArray(source))
      this._data.items = source; // if obj is an array, save it as list of items
    else
      this._data.items = [source]

    // create a child element for each item, populate it, and append it to e
    this._data.items.forEach((item, i) => {
      let itemE;

      // if item is already an AmplfrItem
      if (item instanceof AmplfrItem)
        itemE = item; // just save item as itemE
      else
        // itemE = new AmplfrItem(item, this._options.media); // upgrade item to be an AmplfrItem
        itemE = new AmplfrItem(item, {
          // controls: this._options.controls.controls,
          logo: false,
          media: this._options.media,
        }); // upgrade item to be an AmplfrItem

      // preload a select number of items
      if (i < this._options.preloadCount)
        itemE.appendMedia();

      // return itemE; // save the itemE
      this._data.items[i] = itemE; // save the itemE
    });
  }

  _makeDraggable() {
    this._options.root.setAttribute("draggable", true);
    this._options.root.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("application/json", JSON.stringify(this._data));
      e.dataTransfer.setData("text/uri-list", this.sourceURL());
      e.dataTransfer.setData("text/plain", this.sourceURL());
    });
  }

  at(position) {
    return this.items[position]
  }

  appendItems() {
    // use specified OL element if present. must already exist
    if (this._options.ol != null)
      this._options.items = this._options.ol
    else {
      const e = document.createElement("ol");
      this._options.root.appendChild(e);
      this._options.items = e
    }

    // ensure classList includes "items"
    this._options.items.classList.add("items");

    // create a child element for each item, populate it, and append it to e
    this._data.items.forEach((item, i) => this._options.items.appendChild(this._appendItem(item)))

    // setup a MutationObserver to check if the last LI is empty (no children)
    // this._options.observer = new MutationObserver((list) => {
    //   // if (this._data.items.length != this._options.items.children)
    //   console.log('mutation list', list);
    // });
    this._options.observer = new MutationObserver((changes) => this._pruneItems(changes));
    this._options.observer.observe(this._options.items, {
      childList: true,
    });
  }
  _appendItem(item) {
    if (item == null) return
    const _this = this
    const li = document.createElement("li");

    li.appendChild(item); // append itemE to the LI

    // add per-item event handlers
    li.addEventListener("dblclick", function (ev) {
      let item = ev.target.querySelector('.item') || ev.target
      if (item.getAttribute('is') == 'amplfr-item') {
        ev.preventDefault();
        _this.item = item
      }
    });
    // li.addEventListener("touchend", function (ev) {
    li.addEventListener("pointerdown", function (ev) {
      if (ev.detail <= 1) return
      let item = ev.target.querySelector('.item') || ev.target
      if (item.getAttribute('is') == 'amplfr-item') {
        ev.preventDefault();
        _this.item = item
      }
    });

    return li
  }
  _pruneItems(changes) {
    // console.log('mutation list', changes);
    if (this._data.items.length != this._options.items.children.length + this._options.playing.children.length)
      this._options.items.childNodes.forEach(e => {
        if (!e.hasChildNodes() && e.tagName === 'LI')
          e.remove()
      })
  }

  /**
   * Appends child HTMLMediaElement for the current item.
   * @param {string} [type='audio']
   */
  // prettier-ignore
  async appendMedia(type) { this._options.current.appendMedia(type); }

  // prettier-ignore
  get sourceID() { return `${this.domain}-${this._data?.id}`; }
  // prettier-ignore
  get src() {
    return this._options?.src || !this._options?.currentSrc;
  }
  // prettier-ignore
  get domain() { return this._data.domain || null; }
  // prettier-ignore
  get artist() { return this.artists; }
  get artists() {
    if (!this._data.artists)
      this._data.artists = new Set(this.items.map(item => item.artists()))

    return this._data.artists;
  }
  // prettier -ignore
  // get items() { return this._options.items || null }
  get items() {
    if (!this._data.items)
      this._data.items = this._options.root.querySelectorAll(".item"); // save all of the items

    return this._data.items;
  }
  // prettier-ignore
  get length() { return this.items.length; }
  /**
   * Returns the index of the current item
   */
  // prettier-ignore
  get item() { return this._options.itemNumber; }
  /**
   * Returns the index of the current item
   * {@see AmplfrCollection#item}
   */
  // prettier-ignore
  get track() { return this._options.itemNumber; }

  // collection controls
  /**
   * Changed item event
   * @event AmplfrItem#change
   * @type {object}
   * @property {number} number The index of the currently selected item
   * @property {AmplfrItem} item The currently selected item
   */
  /**
   * Sets the current item
   * @param {number|AmplfrItem} i The index of the item to select or specifc item to select.
   * @emits AmplfrItem#change
   * @emits ended Fired once the last item finishes
   */
  set item(i) {
    /**
     * item() sets the current item to play in the collection
     *  - puts currently playing item in Played
     *  - gets requested item, and puts it in Playing
     *    - has to remove the requested item's parent element
     *    - has to determine the "direction" - if previous, then need to get item from Played
     */
    if (this._options.media == false || this.items.length < 1) return
    let forwardDirection
    let itemE
    let itemNumber
    const itemCount = this.items.length;
    if (typeof i == 'number') {
      if (i == this._options.itemNumber)
        return; // nothing to do if already set to this._options.itemNumber

      itemNumber = i || 1
      forwardDirection = (i >= (this._options.itemNumber || itemNumber))
      if (i <= 0) i = itemCount + i; // zero or negative values count back from the last item

      itemE = this._data.items[(i - 1) % itemCount]
    }
    else if (i.getAttribute('is') == 'amplfr-item') {
      itemE = i
      itemNumber = this._data.items.indexOf(itemE)
    }
    else return // not sure what i is, so just return

    const isPlaying = this.paused === false ? true : false; // ==false means its playing, but null means nothing
    if (isPlaying === true) this.pause();

    const parentE = itemE.parentElement // needed to clean up otherwise empty LI
    let previous = null

    // move anything in Playing to Played/Items
    if (this._options?.playing?.hasChildNodes()) {
      // const li = this._appendItem(this._options.playing.childNodes[0]) // append itemE to the LI
      previous = this._options.playing.childNodes[0]
      const li = this._appendItem(previous) // append itemE to the LI

      // which list gets what was in Playing?
      if (this.loop) this._options.items.appendChild(li)
      else if (forwardDirection) this._options.played.appendChild(li)
      else this._options.items.insertBefore(li, this._options.items.firstChild)
    }

    this._options.itemNumber = itemNumber % (itemCount + 1)
    this._options.current = itemE

    // create and dispatch an 'ended' event
    const ev = new CustomEvent('change', {
      detail: {
        number: this._options.itemNumber,
        item: this._options.current,
        previous,
      }
    });
    this.dispatchEvent(ev);

    this._options.playing.replaceChildren(itemE)  // move selected itemE to child of playing
    this._options.playing.scrollIntoView()

    // const color = itemE.style.getPropertyValue('--color')
    // const colorAccent = itemE.style.getPropertyValue('--colorAccent')
    // if (color != '' && colorAccent != '') {
    //   const root = document.querySelector(':root')
    //   root.style.setProperty('--color', color)
    //   root.style.setProperty('--colorAccent', colorAccent)
    // }

    // remove parentE as long as it isn't the main list of items, and it doesn't have any child nodes
    if (parentE != this._data.items && !parentE.hasChildNodes())
      parentE.remove()

    if (!this._options.current)
      return; // if #current is bad, just quit

    // this._options.current.classList.add("current"); // newly current item is now current
    if (!!this._options.media)
      this._options.current.appendMedia(); // ensure that #current's media is ready

    // start playing the new item if previous item was playing
    if (isPlaying === true)
      this.play();

    // load the next item unless there isn't one
    if (!!this.items[itemNumber + 1]) {
      const _this = this
      // this._options.current.addEventListener("loaded", function (ev) {
      this._options.current.addEventListener("canplaythrough", function (ev) {
        // console.log(ev.target.closest('.collection').item)
        _this.items[itemNumber + 1].appendMedia()
      }, {
        once: true,
      });
    }

    // if #current is the last item and this.loop is false
    if (this._options.itemNumber == itemCount && !this.loop) {
      // create and dispatch an 'ended' event
      const ev = new Event('ended');
      this.dispatchEvent(ev);
    }
    else // add 'ended' event to go to the next() item
      this._options.current.addEventListener("ended", function (ev) {
        const _this = ev.target.closest('.collection')
        _this.next()
        _this.play()
      }, {
        once: true,
      });
  }
  /**
   * {@see AmplfrCollection#item}
   */
  // prettier-ignore
  set current(i) { this.item(i); }
  /**
   * {@see AmplfrCollection#item}
   */
  // prettier-ignore
  set track(i) { this.item(i); }
  /**
   * Changes the current item to the next in the list
   * {@see AmplfrCollection#item}
   */
  // prettier-ignore
  next() { this.item = (this._options?.itemNumber || 0) + 1; }
  /**
   * Changes the current item to the previous in the list
   * {@see AmplfrCollection#item}
   */
  // prettier-ignore
  previous() { this.item = (this._options?.itemNumber - 1); }
  // prettier-ignore
  loop() { this.loop = !this.loop; }
  // prettier-ignore
  set loop(v = !this._options.loop) {
    this._options.loop = !!v;
    if (!!this._options.controls && this._options.controls['loop'] != null)
      if (this._options.loop)
        this._options.controls['loop'].classList.add('activated')
      else
        this._options.controls['loop'].classList.remove('activated')
  }
  // prettier-ignore
  set muted(v = !this.muted) {
    if (!!this._options.current)
      this._options.current.muted = !!v;
  }
  // prettier-ignore
  set volume(v = 1) {
    if (!!this._options.current)
      this._options.current.volume = v;
  }

  // prettier-ignore
  get duration() { return this._options.current?.duration || null; }
  // prettier-ignore
  get ended() { return this._options.current?.ended || null; }
  // prettier-ignore
  get loop() { return this._options.loop || false; }
  // prettier-ignore
  get muted() { return this._options.current?.muted || null; }
  // prettier-ignore
  get volume() { return this._options.current?.volume || null; }

  // media controls - mapped to this._options.current item
  /**
   * Plays the current item. 
   * If i is set and different from the currently selected item, change to that item, and then play that.
   * @param {number} [i] Optional index of item to play
   * @see AmplfrCollection#item 
   */
  play(i = this._options.itemNumber) {
    if (i !== this._options.itemNumber)
      this.item = i;
    this._options.current?.play();
  }
  // prettier-ignore
  pause() { this._options.current?.pause(); }
  // pause() { this._data.items[this.item - 1].pause(); }
  stop() {
    // (safely) call this._options.current.stop() in case it isn't defined in this._options.current
    try {
      this._options.current.stop();
    } catch (error) {
      // just pause() and then reset the time
      this._options.current?.pause();
      this._options.current?.fastSeek(0);
    }
  }
  // prettier-ignore
  fastSeek(s) { this._options.current?.fastSeek(s); }
  // prettier-ignore
  seekTo(s, precise) { this._options.current?.seekTo(s, precise); }

  // media property set'ers - mapped to this._options.current item
  // prettier-ignore
  set currentTime(v) { this._options.current?.currentTime(v); }
  // prettier-ignore
  set playbackRate(v = 1) {
    if (!!this._options.current)
      this._options.current.playbackRate = v;
  }

  // media property get'ers - each returns null if this._options.media is null
  // prettier-ignore
  get currentTime() { return this._options.current?.currentTime || null; }
  // prettier-ignore
  get networkState() { return this._options.current?.networkState || null; }
  // prettier-ignore
  get paused() { return this._options.current?.paused; }
  // get paused() { return this._data.items[this.item - 1]?.paused; }
  // prettier-ignore
  get playbackRate() { return this._options.current?.playbackRate || null; }
  // prettier-ignore
  get readyState() { return this._options.current?.readyState || null; }
  // prettier-ignore
  get seekable() { return this._options.current?.seekable || null; }

  // TODO need to figure out how to handle/dispatch events
  // addEventListener(type, listener, options) {
  //   mediaListeners = [
  //     "abort",
  //     "canplay",
  //     "canplaythrough",
  //     "durationchange",
  //     "emptied",
  //     "ended",
  //     "error",
  //     "loadeddata",
  //     "loadedmetadata",
  //     "loadstart",
  //     "pause",
  //     "play",
  //     "playing",
  //     "progress",
  //     "ratechange",
  //     "resize",
  //     "seeked",
  //     "seeking",
  //     "stalled",
  //     "suspend",
  //     "timeupdate",
  //     "volumechange",
  //     "waiting",
  //   ];
  //   if (mediaListeners.includes(type))
  //     this._options.media.addEventListener(type, listener, options);
  //   // else this.addEventListener(type, listener, options)
  // }
  /**
   * connectedCallback() is called when this element is (re-)added to the DOM
   */
  async connectedCallback() {
    this.render()
  }

  async render() {
    if (!!this._options.isBuilt) return; // no need to build again if already done
    this._options.isBuilt = 'building'

    // has _data been completely processed yet?
    if (!this._data || !!this._data.then) await this._populate();

    // start the build
    if (!!this._options.useShadow)
      this._options.root = document.createElement("div");
    else
      this._options.root = this;

    this._options.root.classList.add("collection");
    // this._options.root.dataset.id = this.domain + "=" + this._data.id; // FIXME
    // TODO - need to differentiate between Collections that:
    //  a) all items are on the same album, etc.
    //    - single artwork/album
    //    - each item can be a little smaller/more compact
    //    - artwork, album, controls all in header
    //    - "unified" look for items
    //  b) items are on multiple/unknown albums
    //    - artwork/album per item
    //    - more simple header - title, controls
    //    - already works, but header is TODO
    // this.appendArtwork(); // handle special case artwork
    // this.appendChildTags(this._options.root, this._data, [
    //   "title",
    //   "collection",
    // ]);
    // this.appendTitle();
    // this.appendPlayed();
    this.appendPlaying();
    // this.appendLogo(this._options.root);
    // this.appendControls();
    this.appendItems(); // handle special case items
    this.appendControls();
    // this.appendControlsAdditional();

    this._options.isBuilt = true; // get here, and there's no need to run again


    // finishing touches
    if (!!this._data.title)
      this._options.root.setAttribute("title", this._data.title);
    // this._makeDraggable(); // make it dragable

    // once the items and the OL have been appended
    // this._options.items = this._options.root.querySelectorAll(".item"); // save all of the items
    this.item = 1; // select the first item

    // finish up the build
    const isReady = new Event('rendered')
    this.dispatchEvent(isReady)
    if (!this._options.useShadow || !this.shadowRoot)
      return;
    const shadow = this.attachShadow({ mode: "open" }); // Create a shadow root


    // Apply external styles to the shadow dom
    const linkElem = document.createElement("link");
    linkElem.setAttribute("rel", "stylesheet");
    linkElem.setAttribute("href", `/css/collection.css`);

    // Attach the created elements to the shadow dom
    shadow.appendChild(linkElem);
    shadow.appendChild(this._options.root);
  }

  appendPlayed(root = this._options.root) {
    if (this._options.controls?.played == false) return
    // add the control button
    const playedE = document.createElement("ol");
    playedE.setAttribute('id', 'played')
    playedE.classList.add("played");
    playedE.classList.add("items");

    this._options.played = playedE; // save playedE for easy access later
    root.appendChild(playedE);
  }

  appendPlaying(root = this._options.root) {
    // use specified OL element if present. must already exist
    // add the control button
    if (this._options.playing != null)
      this._options.playing = this._options.playing
    else {
      const playingE = document.createElement("div");
      // playingE.setAttribute('id', 'playing')

      root.appendChild(playingE);
      this._options.playing = playingE; // save playingE for easy access later
    }

    // make sure this has its ID set as "playing"
    this._options.playing.setAttribute('id', 'playing')

    // set the first item for Playing *after* appending playingE
    // this.item = 1

    // do *not* set the item to play yet
    // do it at the end of render()
  }

  appendControls(root = this._options.root) {
    if (this._options.controls == false) return
    // add the control button
    // const e = document.createElement("div");
    const e = document.createElement("button");
    e.setAttribute('id', 'controls')
    e.classList.add("controls");
    root.appendChild(e);
    if (this.items.length == 1) e.classList.add('hidden')

    this._options.controls = this._options.controls || {};  // e; // save for easy access later

    const _this = this;
    const controls = [
      {
        id: 'previous',
        title: "Previous",
        text: 'skip_previous',
        _this,
        updateStatus: (e) => {
          if (!_this.loop && (_this.item <= 1 || !_this.item)) e.classList.add('disabled')
          else e.classList.remove('disabled')
        },
        fn: _this.previous
      },
      {
        id: 'loop',
        title: "Repeat",
        text: 'repeat',
        _this,
        updateStatus: (e) => {
          if (_this.loop) e.classList.add('activated')
          else e.classList.remove('activated')
        },
        fn: () => { _this.loop = (!_this.loop) }
      },
      {
        id: 'shuffle',
        title: "Shuffle",
        text: 'shuffle',
        _this,
        fn: _this.shuffle
      },
      {
        id: 'share',
        title: "Share",
        text: 'share',
        _this,
        fn: _this.share
      },
      {
        id: "search",
        title: "Search",
        _this,
        text: "search",
        fn: () => { }
      },
      {
        id: 'next',
        title: "Next",
        text: 'skip_next',
        _this,
        updateStatus: (e) => {
          if (_this.length > 0 && _this.item >= _this.length && !_this.loop) e.classList.add('disabled')
          else e.classList.remove('disabled')
        },
        fn: _this.next
      },
    ]
    this._options.controlsToUpdate = this._options.controlsToUpdate || {}
    controls.forEach(ctrl => {
      const ce = document.createElement("div");
      ce.setAttribute('id', ctrl.id)
      ce.setAttribute('title', ctrl.title)
      // ce.classList.add("material-icons");
      // ce.classList.add("md-light");
      ce.classList.add("material-symbols-outlined");
      if (ctrl.class) ctrl.class.split(/\s/).forEach((cls) => ce.classList.add(cls))
      if (ctrl.updateStatus && typeof ctrl.updateStatus == 'function') {
        ctrl.updateStatus(ce)

        this._options.controlsToUpdate[ctrl.id] = ctrl.updateStatus
      }
      ce.innerText = ctrl.text
      e.appendChild(ce);
      this._options.controls[ctrl.id] = ce


      function action(ev) {
        ev.preventDefault();
        if (ev.target.classList.contains('disabled')) return // don't do anything if target is disabled
        ctrl.fn.bind(_this)(ev);
        // if (ctrl.updateStatus && typeof ctrl.updateStatus == 'function') ctrl.updateStatus(ev.target)

        // run through all of the controls that may be affected by an outside change
        Object.entries(_this._options.controlsToUpdate).forEach(([id, fn]) => {
          fn(_this._options.controls[id])
        })
      }
      ce.addEventListener("click", (ev) => action(ev));
      ce.addEventListener("touchend", (ev) => action(ev));
      // ce.addEventListener("touchend", function (ev) {
      //   ev.preventDefault();
      //   if (ev.target.classList.contains('disabled')) return // don't do anything if target is disabled
      //   ctrl.fn.bind(_this)(ev);
      //   if (ctrl.updateStatus && typeof ctrl.updateStatus == 'function') ctrl.updateStatus(ev.target)
      // });
    })
  }
  appendControlsAdditional(root = this._options.root) {
    // add the control button
    const e = document.createElement("div");
    e.setAttribute('id', 'additional')
    e.classList.add("controls");
    root.appendChild(e);
    if (this.items.length == 1) e.classList.add('hidden')

    this._options.controls = this._options.controls || {}; // save for easy access later

    const _this = this;
    const controls = [
      {
        id: "playlist",
        title: "Playlist",
        _this,
        text: "playlist_play",
        fn: (e) => {
          this.classList.toggle('minimized')
          e.target.classList.toggle('activated')
        }
      },
      {
        id: "history",
        title: "History",
        _this,
        text: "history",
        fn: () => { }
      },
      {
        id: "add",
        title: "Add",
        _this,
        text: "playlist_add",
        fn: () => { }
      },
    ]
    controls.forEach(ctrl => {
      const ce = document.createElement("div");
      ce.setAttribute('id', ctrl.id)
      ce.setAttribute('title', ctrl.title)
      ce.classList.add("material-icons");
      ce.classList.add("md-light");
      if (ctrl.class) ctrl.class.split(/\s/).forEach((cls) => ce.classList.add(cls))
      ce.innerText = ctrl.text
      e.appendChild(ce);

      ce.addEventListener("click", function (ev) {
        ev.preventDefault();
        ctrl.fn.bind(_this)(ev);
      });
      ce.addEventListener("touchend", function (ev) {
        ev.preventDefault();
        ctrl.fn.bind(_this)(ev);
      });
    })
  }
  share() {
    return 'https://amplfr.com/#' + this.items.map(e => e.id).join('+')
  }
}
// prettier-ignore
customElements.define("amplfr-collection", AmplfrCollection, { extends: "div" });
