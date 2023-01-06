const validAmplfrCollectionID =
  /[0-9A-Za-z]{1,25}\/[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{22}/;

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
 * The overriding methods (e.g. {@link AmplfrCollection#play}) operates on the currently selected Item, whereas methods like {@link AmplfrCollection#item} (or AmplfrCollection.item = N) sets the currently selected Item.
 * @name AmplfrCollection
 * @see {@link AmplfrItem}
 * @class
 * @extends {AmplfrItem}
 * @inheritdoc
 * 
 * Displayed the same as AmplfrItem if only one Item is listed, but
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
   */
  constructor(data) {
    super(false); // Always call super first in constructor

    this._data = {};
    this._options = {};

    this._options.useShadow = false; // toggle if resulting elements should go in shadow DOM instead
    this._options.preloadCount = 2; // navigator.hardwareConcurrency || 2; // max number of items to preload


    // only if this object is an AmplfrCollection vs some extended class
    if (this instanceof AmplfrCollection) {
      if (!!AmplfrItem && AmplfrItem.isAmplfrID(data)) // single AmplfrID
        data = [data]

      if (typeof data == "string") {
        // if data has any whitespace characters (a URL should not)
        //  then split on each whitespace character and save each token as an item
        if (/\s/.test(data))
          this._data.items = data.split(/\s/);
        else if (data.match(validAmplfrCollectionID)) {
          // use a URL that points to the API endpoint for the AmplfrID
          this._options.src = document.location.origin + `/api/${data}.json`;
          this._data = AmplfrCollection.parseAmplfr(this.src); // parse url as a Amplfr URL, saving the promise
        }
        // if data is a string, hopefully it's a URL (under 2083 characters) with additional data
        else if (data.length <= 2083) {
          this._data = this._parse(data); // fetch the URL, saving the promise
        }
      } else if (Array.isArray(data)) {
        // look at each of the entries as its own AmplfrItem
        this._data = data.map((x) => AmplfrCollection.parse(x)); // super.parse(x));

        // this._populate(data); // now populate the data
      } else
        this._populate(data);
    }
  }

  static async parseAmplfr(url) {
    if (!AmplfrCollection.#parseAmplfrFn) {
      let { default: parseAmplfr } = await import('./parseAmplfr.js')
      AmplfrCollection.#parseAmplfrFn = parseAmplfr
    }

    return AmplfrCollection.#parseAmplfrFn(url)
  }

  /**
   * Fetches the given URL, parses the received media file, and returns an object with the extracted metadata.
   * The return object can be used as input for _populate().
   * @param {string} [url] The URL endpoint/file to fetch and parse.
   * @returns {CollectionSourceData}
   */
  async _parse(url) {
    if (!url && !!this.src)
      url = this.src; // use src

    let obj;
    let urlObj;
    try {
      // if url is actually a URL, then fetch(url) and save the results
      urlObj = new URL(url);
      this._data.domain = urlObj.hostname.replace(/www\.|m\./, "");
      this._data.url = urlObj;
    } catch (error) {
      // url isn't a URL
      urlObj = null;
      this._data.domain = "";
    }

    let text = url;
    try {
      if (!!urlObj) {
        // if urlObj isn't null then url is a URL
        const response = await fetch(url);
        // const size = parseInt(response.headers.get("Content-Length"), 10);
        const mime = response.headers.get("Content-Type");

        if (response.ok && !!response.body) {
          // if response is JSON, just return response as JSON
          if (mime === "application/json")
            return await response.json();

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
              return this._parseM3U(urlObj, text);
              break;

            default: // split by whitespace into separate items
              break;
          }
        }
      }
    } catch (error) { }
    obj = {};
    obj.items = text.split(/\s/);

    return obj;
  }
  /**
   * Parses M3U (or M3U8) text and extracts the needed data to build the object
   * @param {URL|string} urlObj The URL used as base URL for any relative URLs. Removes any text after the last '/' for the base path.
   * @param {string} text The raw M3U (M3U8) text
   * @returns {CollectionSourceData}
   */
  _parseM3U(urlObj, text) {
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
  async _populate(obj) {
    if (!!this._data) {
      // was this._parse(URL) called in the constructor?
      if (this._data.then) {
        obj = await this._data; // await for the Promise to resolve
        this._data = {}; // reset _data object
      } else if (Array.isArray(this._data) && this._data[0].then) {
        // await for all of the Promises to resolve
        obj = await Promise.allSettled(this._data);
        obj = obj.map((x) => x.value);
        this._data = {}; // reset _data object
      }
    }

    // check if there's enough data already provided
    if (!obj) {
      if (Object.keys(this.dataset).length > 1)
        obj = this.dataset; // use dataset
      else if (!!this.src)
        obj = this.src; // use src
      else
        return; // nothing else to do here
    }

    // if obj is a string, hopefully it's a URL (under 2083 characters) with additional data
    if (typeof obj == "string" && obj.length <= 2083) {
      let url = obj;
      obj = await this._parse(url);
    }

    // pull out all of the "string" keys from obj, saving to this.dataset
    const keys = ["id", "url", "title", "artwork", "items", "start", "end"];
    keys.forEach((k) => {
      if (!!obj[k] && typeof obj[k] == "string")
        this._data[k] = obj[k];
    });

    // add the obj.artists (or obj.artist) to a flattened array
    let artists = [];
    if (!!obj.artists)
      artists.push(...obj.artists);
    if (!!obj.artist)
      artists.push(obj.artist);
    if (artists.length > 0)
      this._data.artists = artists.flat();

    if (Array.isArray(obj))
      this._data.items = obj; // if obj is an array, save it as list of items

    if (!!this._data?.title)
      this.title = this._data.title;

    // create a child element for each item, populate it, and append it to e
    // items.forEach((item, i) => {
    // this._options.items = this._data.items.map((item, i) => {
    this._data.items.forEach((item, i) => {
      let itemE;

      // if item is already an AmplfrItem
      if (item instanceof AmplfrItem)
        itemE = item; // just save item as itemE
      else
        // itemE = new AmplfrItem(item, {
        //   controls: false,
        //   standalone: false,
        // }); // upgrade item to be an AmplfrItem
        itemE = new AmplfrItem(item); // upgrade item to be an AmplfrItem

      // preload a select number of items
      if (i < this._options.preloadCount)
        itemE.appendMedia();

      // return itemE; // save the itemE
      this._data.items[i] = itemE; // save the itemE
    });
    // set needed fields that may not be set yet
    // let url = this._data?.url || this.src;
    // if (!!url) {
    //   try {
    //     this._data.url = new URL(url);
    //   } catch (err) {}
    //   this.src = this._data?.url.href || url;
    //   this._data.domain =
    //     this._data.domain || this._data?.url.hostname.replace(/www\.|m\./, "");
    // }
    // if (!this._data.id)
    //   // from https://gist.github.com/hyamamoto/fd435505d29ebfa3d9716fd2be8d42f0?permalink_comment_id=4261728#gistcomment-4261728
    //   this._data.id =
    //     this._data.id ||
    //     (
    //       `${this.domain}-${this._data.url.pathname}${this._data.url.search}` ||
    //       ""
    //     )
    //       .split("")
    //       .reduce((s, c) => (Math.imul(31, s) + c.charCodeAt(0)) | 0, 0);
  }

  _makeDraggable() {
    this._options.root.setAttribute("draggable", true);
    this._options.root.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("application/json", JSON.stringify(this._data));
      e.dataTransfer.setData("text/uri-list", this.sourceURL());
      e.dataTransfer.setData("text/plain", this.sourceURL());
    });
  }

  appendItems() {
    const e = document.createElement("ol");
    e.classList.add("items");

    this._options.root.appendChild(e);

    this._options.items = e

    // create a child element for each item, populate it, and append it to e
    this._data.items.forEach((item, i) => e.appendChild(this.#appendItem(item)))
  }
  #appendItem(item) {
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
    li.addEventListener("touchend", function (ev) {
      let item = ev.target.querySelector('.item') || ev.target
      if (item.getAttribute('is') == 'amplfr-item') {
        ev.preventDefault();
        _this.item = item
      }
    });

    return li
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
  // prettier-ignore
  get artists() { return this._data?.artists || null; }
  // prettier -ignore
  // get items() { return this._options.items || null }
  get items() {
    if (!this._data.items)
      this._data.items = this._options.root.querySelectorAll(".item"); // save all of the items

    return this._data.items;
  }
  // prettier-ignore
  get item() { return this._options.itemNumber; }
  // prettier-ignore
  get track() { return this._options.itemNumber; }

  // collection controls
  /**
   * Sets the current item
   * @param {number} i The index of the item to select.
   */
  set item(i) {
    /**
     * item() sets the current item to play in the collection
     *  - puts currently playing item in Played
     *  - gets requested item, and puts it in Playing
     *    - has to remove the requested item's parent element
     *    - has to determine the "direction" - if previous, then need to get item from Played
     */
    let forwardDirection
    let itemE
    let itemNumber
    const itemCount = this.items.length;
    if (typeof i == 'number') {
      if (i == this._options.itemNumber)
        return; // nothing to do if already set to this._options.itemNumber

      if (i <= 0) i = itemCount + i; // zero or negative values count back from the last item

      itemE = this._data.items[(i - 1) % itemCount]
      itemNumber = i || 1
      forwardDirection = (i >= (this._options.itemNumber || itemNumber))
    }
    else if (i.getAttribute('is') == 'amplfr-item') {
      itemE = i
      // forwardDirection = false  // insert what was Playing back 
      itemNumber = this._data.items.indexOf(itemE)
    }
    else return // not sure what i is, so just return

    const isPlaying = this.paused === false ? true : false; // ==false means its playing, but null means nothing
    if (isPlaying === true) this.pause();

    const parentE = itemE.parentElement // needed to clean up otherwise empty LI

    // move anything in Playing to Played/Items
    if (this._options.playing.hasChildNodes()) {
      const li = this.#appendItem(this._options.playing.childNodes[0]) // append itemE to the LI

      // which list gets what was in Playing?
      if (this.loop) this._options.items.appendChild(li)
      else if (forwardDirection) this._options.played.appendChild(li)
      else this._options.items.insertBefore(li, this._options.items.firstChild)
    }

    this._options.itemNumber = itemNumber
    this._options.current = itemE
    this._options.playing.replaceChildren(itemE)
    this._options.playing.scrollIntoView()

    // remove parentE as long as it isn't the main list of items, and it doesn't have any child nodes
    if (parentE != this._data.items && !parentE.hasChildNodes())
      parentE.remove()

    if (!this._options.current)
      return; // if #current is bad, just quit

    // this._options.current.classList.add("current"); // newly current item is now current
    this._options.current.appendMedia(); // ensure that #current's media is ready


    // start playing the new item if previous item was playing
    if (isPlaying === true)
      this.play();

    if (this._options.itemNumber == 1 && this.loop == false) {
      // disable the previous button
      this._options.controls.querySelector('#previous').classList.add('disabled')
    }

    // if #current is the last item and this.loop is false
    if (this._options.itemNumber == itemCount && !this.loop) {
      // disable the next button
      this._options.controls.querySelector('#next').classList.add('disabled')

      // create and dispatch an 'ended' event
      const ev = new Event('ended');
      this.dispatchEvent(ev);
    }
    else // add 'ended' event to go to the next() item
      this._options.current.addEventListener("ended", this.next, {
        once: true,
      });
  }
  // prettier-ignore
  set track(i) { this.item(i); }
  // prettier-ignore
  next() { this.item = (this._options?.itemNumber || 0) + 1; }
  // prettier-ignore
  previous() { this.item = (this._options?.itemNumber - 1 || 1); }
  // prettier-ignore
  loop() { this.loop = !this.loop; }
  // prettier-ignore
  set loop(v = !this._options.loop) {
    this._options.loop = !!v;
    // if (this._options.loop == true) 
    // this._options.controls.querySelector('#repeat').classList.toggle('activated')
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
  play(i = this._options.itemNumber) {
    if (i !== this._options.itemNumber)
      this.item = i;
    this._options.current?.play();
  }
  // prettier-ignore
  pause() { this._options.current?.pause(); }
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
  get paused() { return this._options.current?.paused || null; }
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

    if (!this._data?.src) await this._populate();

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
    this.appendPlayed();
    this.appendPlaying();
    this.appendLogo(this._options.root);
    this.appendControls();
    this.appendItems(); // handle special case items
    this.appendControlsAdditional();

    this._options.isBuilt = true; // get here, and there's no need to run again


    // finishing touches
    if (!!this._data.title)
      this._options.root.setAttribute("title", this._data.title);
    // this._makeDraggable(); // make it dragable

    // once the items and the OL have been appended
    // this._options.items = this._options.root.querySelectorAll(".item"); // save all of the items
    this.item = 1; // select the first item

    // finish up the build
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
    // add the control button
    const playedE = document.createElement("ol");
    playedE.setAttribute('id', 'played')
    playedE.classList.add("played");
    playedE.classList.add("items");

    this._options.played = playedE; // save playedE for easy access later
    root.appendChild(playedE);
  }

  appendPlaying(root = this._options.root) {
    // add the control button
    const playingE = document.createElement("div");
    playingE.setAttribute('id', 'playing')

    this._options.playing = playingE; // save playingE for easy access later

    root.appendChild(playingE);

    // set the first item for Playing *after* appending playingE
    // this.item = 1

    // do *not* set the item to play yet
    // do it at the end of render()
  }

  appendControls(root = this._options.root) {
    // add the control button
    const e = document.createElement("div");
    e.setAttribute('id', 'controls')
    e.classList.add("controls");
    root.appendChild(e);
    if (this.items.length == 1) e.classList.add('hidden')

    this._options.controls = e; // save for easy access later

    const _this = this;
    const controls = [
      {
        id: 'previous',
        title: "Previous",
        text: 'skip_previous',
        _this,
        fn: _this.previous
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
        id: 'shuffle',
        title: "Shuffle",
        text: 'shuffle',
        _this,
        fn: _this.shuffle
      },
      {
        id: 'next',
        title: "Next",
        text: 'skip_next',
        _this,
        fn: _this.next
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
  appendControlsAdditional(root = this._options.root) {
    // add the control button
    const e = document.createElement("div");
    e.setAttribute('id', 'additional')
    e.classList.add("controls");
    root.appendChild(e);
    if (this.items.length == 1) e.classList.add('hidden')

    this._options.controls_additional = e; // save for easy access later

    const _this = this;
    const controls = [
      {
        id: "playlist",
        title: "Playlist",
        // class: "activated",
        _this,
        text: "playlist_play",
        fn: (e) => {
          this.classList.toggle('minimized')
          e.target.classList.toggle('activated')
        }
      },
      {
        id: "add",
        title: "Add",
        _this,
        text: "playlist_add",
        fn: () => { }
      },
      {
        id: "history",
        title: "History",
        _this,
        text: "history",
        fn: () => { }
      },
      {
        id: 'repeat',
        title: "Repeat",
        text: 'repeat',
        _this,
        // fn: _this.loop
        fn: () => { _this.loop = (!_this.loop) }
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
}
// prettier-ignore
customElements.define("amplfr-collection", AmplfrCollection, { extends: "div" });
