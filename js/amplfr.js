// prettier-ignore
const validAmplfrID = /[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{22}/;
/**
 * Data fields that make up an AmplfrArtist
 * @typedef {object} AmplfrArtist
 * @property {string} name - Name of the artist.
 * @property {string|string[]} [links] - URLs related to this artist.
 * @property {number|Date} [started] - Start year/date for artist.
 * @property {number|Date} [ended] - End year/date for artist.
 * @property {string} [url] - Canonical URL for this artist.
 * @example {
 *  name: "Foo Fighters",
 *  started: 1994,
 *  links: [
 *    "https://www.instagram.com/foofighters/",
 *    "https://musicbrainz.org/artist/67f66c07-6e61-4026-ade5-7e782fad3a5d",
 *    "https://twitter.com/foofighters/"
 *  ]
 * }
 */
/**
 * Data fields needed to build an AmplfrItem
 * @typedef {object} ItemSourceData
 * @property {string} url - Canonical URL for the item.
 * @property {string} title - Title of the item.
 * @property {AmplfrArtist[]|AmplfrArtist|string|string[]} [artists] - Artist(s) that made the item.
 * @property {string} [artwork] - URL for artwork. If not specified, attempts to extract image from the media file the URL points at.
 * @property {string} [mime] - The MIME type of the media file. If not specified, attempts to extract the MIME type of the media file the URL points at.
 * @property {Number} [start=0.0] - Time (in seconds) to start playback.
 * @property {Number} [end=NULL] - Time (in seconds) to end playback.
 */
/**
 * Data fields needed to build an AmplfrCollection
 * @typedef {object} CollectionSourceData
 * @property {string} url - Canonical URL for the collection
 * @property {string} title - Title of the collection
 * @property {AmplfrItem[]|string[]} items - In order list of items that make up the collection. Each item can be an ItemElement object, URL, AmplfrID, or other supported identifier.
 * @property {string} [artwork] - URL for artwork
 */

const assignDataset = (datasetObj, obj, keys = null) => {
  keys = keys || Object.keys(obj);
  keys.forEach((k) => {
    if (!!obj[k]) datasetObj[k] = obj[k];
  });
};

/**
 * Fetches the given URL, parses the received media file, and returns an object with the extracted metadata.
 * The return object can be used as input for #populate().
 * @param {string} [url] The URL endpoint/file to fetch and parse. Only works if the result is a media file with metadata.
 * @private
 * @returns {ItemSourceData}
 */
const parseURL = async (url) => {
  // TODO need to pull in https://github.com/Borewit/music-metadata-browser
  // const mm = import(https://github.com/Borewit/music-metadata-browser)
  const response = await fetch(url);
  const fileInfo = {
    size: parseInt(response.headers.get("Content-Length"), 10),
    mime: response.headers.get("Content-Type"),
  };

  if (response.ok) {
    if (response.body) {
      const res = await mm.parseReadableStream(
        response.body,
        fileInfo,
        options
      );
      if (!response.body.locked) {
        // Prevent error in Firefox
        await response.body.cancel();
      }
      return res;
    } else {
      // Fall back on Blob
      return mm.parseBlob(await response.blob(), options);
    }
  }
  const { common } = await mm.fetchUrl(url);

  return (obj = {
    title: common.title,
    artists: common.artists,
    artwork: `data:${
      common.picture.format
    };base64,${common.picture.data.toString("base64")}`,
    mime: fileInfo.mime,
    url,
  });
};
/**
 * Fetches the given URL, parses the received media file, and returns an object with the extracted metadata.
 * The return object can be used as input for #populate().
 * @param {string} [url] The URL endpoint/file to fetch and parse. Only works if the result is a media file with metadata.
 * @private
 * @returns {ItemSourceData}
 */
const parseAmplfr = async (url) => {
  if (!url && !!this.src) url = this.src; // use src

  // const response = await fetch(url);
  // let obj = await response.json();
  let obj = await fetch(url)
    .then((response) => response.json())
    .then((results) => results)
    .catch((err) => {
      console.warn(err);
      // return null;
    });

  obj = {
    id: obj.id,
    title: obj.title,
    artists: obj.artists,
    artwork: "/albumart/" + (obj.albumid || `item/${obj.id}`) + ".jpg",
    url: obj.url || url,
  };

  // get the list of media files
  const media = document.createElement("video");
  const files = await fetch(`/api/${obj.id}.files`)
    .then((response) => response.json())
    .catch((err) => {
      return null;
    });
  obj.src = files
    // return the list media that client might be able to play
    .filter((f) => media.canPlayType(f.mime || f) !== "")
    .map((f) => {
      f.src = url
        .substring(0, url.indexOf(".", -8))
        .replace(obj.id, f.filename); // use f.filename to set the correct src
      return f;
    })
    // TODO sort by bitrate, and *then* by what's playable
    .sort((a, b) => {
      // prefer media files that are playable by client
      const map = {
        probably: 1,
        maybe: 2,
        "": 3,
      };

      if (map[a] < map[b]) return -1; // a < b
      else if (map[a] > map[b]) return 1; // a > b
      else return 0; // a = b
    });

  return obj;
};

/**
 * AmplfrItem is an HTML element created from a URL, comprised of the related Title, Artist(s), and other metadata.
 * @name AmplfrItem
 * @extends HTMLDivElement
 */
class AmplfrItem extends HTMLDivElement {
  #useShadow = false; // toggle if resulting elements should go in shadow DOM instead
  #childTags;
  #data; // holds internal data object
  #media; // holds the media object
  #mediaType; // the media type
  #root; // the root HTML element
  #loopCounter;
  #isBuilt;
  // #functions; // functions for supported specific domains

  /**
   * @param {ItemSourceData|string|null} data ItemSourceData object or URL to populate the element. Using a null value will use the element's dataset or src attributes.
   * @param {string|boolean|null} [mediaType] "Audio" or "video" to indicate the type to be used for the child HTMLMediaElement created as part of creating this when added to the DOM.
   * If non-null value is given, then the child HTMLMediaElement will be created once added to the DOM - e.g., document.body.appendChild(AmplfrItem).
   * If null (default) value is used, then the child HTMLMediaElement will not be created until appendMedia() is called.
   */
  constructor(data, mediaType = null) {
    super(); // Always call super first in constructor

    this.#data = {};
    this.#mediaType = mediaType;
    this.#childTags = ["title", "collection"];

    // only if this object is an AmplfrItem vs some extended class
    if (this instanceof AmplfrItem)
      if (typeof data == "string") {
        // check if domain is just an AmplfrID
        if (data.match(validAmplfrID)) {
          // use a URL that points to the API endpoint for the AmplfrID
          this.src = document.location.origin + `/api/${data}.json`;
          this.#data = parseAmplfr(this.src); // parse url as a Amplfr URL, saving the promise
        }
        // if data is a string, hopefully it's a URL (under 2083 characters) with additional data
        else if (data.length <= 2083) {
          this.src = data; // save the URL
          this.#data = this.#parse(this.src); // fetch the URL, saving the promise
        }
      } else this.#populate(data);
  }

  /**
   * Fetches the given URL, parses the received media file, and returns an object with the extracted metadata.
   * The return object can be used as input for #populate().
   * @param {string} [url] The URL endpoint/file to fetch and parse.
   * @returns {ItemSourceData}
   */
  async #parse(url) {
    if (!url && !!this.src) url = this.src; // use src

    let urlObj;
    // try to slice up the URL and save the domain part
    try {
      urlObj = new URL(url);
      this.#data.domain = urlObj.hostname.replace(/www\.|m\./, "");
    } catch (err) {
      this.#data.domain = url; // in case url wasn't a real URL
    }

    let obj;
    switch (this.#data.domain) {
      case "amplfr":
      case "amplfr.com":
        obj = parseAmplfr(url);
        break;
      default:
        // check if domain is just an AmplfrID
        if (typeof url == "string" && url.match(validAmplfrID)) {
          // use a URL that points to the API endpoint for the AmplfrID
          url = document.location.origin + `/api/${url}.json`;
          obj = parseAmplfr(url); // parse url as a Amplfr URL
          break;
        }

        obj = parseURL(url);
        break;
    }

    // try to extract start and end times if url is actually a URL
    try {
      let { searchParams } = new URL(url);
      obj.start = searchParams["s"] || !!searchParams["start"] || undefined;
      obj.end = searchParams["e"] || !!searchParams["end"] || undefined;
    } catch (error) {
      // can't get what's not there, so no worries if an exception was thrown
    }

    return obj;
  }

  /**
   *
   */
  async #populate(source) {
    if (!!this.#data) {
      // was this.#parse(URL) called in the constructor?
      if (this.#data.then) {
        source = await this.#data; // await for the Promise to resolve
        this.#data = {}; // reset #data object
      }
    }

    // check if there's enough data already provided
    const dataset = Array.from(this.dataset);
    if (!source) {
      if (dataset.length > 0) source = dataset; // use dataset
      else if (!!this.src) source = this.src; // use src
      else return; // nothing else to do here
    }

    // pull out all of the "string" keys from obj, saving to this.dataset
    const keys = ["id", "url", "title", "artwork", "albumid", "start", "end"];
    keys.forEach((k) => {
      if (!!source[k] && typeof source[k] == "string")
        this.#data[k] = source[k];
    });

    // add the obj.artists (or obj.artist) to a flattened array
    let artists = [];
    if (!!source.artists) artists.push(...source.artists);
    if (!!source.artist) artists.push(source.artist);
    if (artists.length > 0) this.#data.artists = artists.flat();

    if (!!source.src) this.#data.src = source.src; // if src exists, save it

    this.title = this.#data?.title; // save the title as the title of the element

    // set needed fields that may not be set yet
    let url = this.#data?.url || this.src;
    if (!!url) {
      try {
        this.#data.url = new URL(url);
      } catch (err) {}
      this.src = this.#data?.url.href || url;
      this.#data.domain =
        this.#data.domain || this.#data?.url.hostname.replace(/www\.|m\./, "");
    }
    if (!this.#data.id)
      // from https://gist.github.com/hyamamoto/fd435505d29ebfa3d9716fd2be8d42f0?permalink_comment_id=4261728#gistcomment-4261728
      this.#data.id =
        this.#data.id ||
        `${this.domain}-` +
          `${this.#data.url.pathname}${this.#data.url.search}`
            .split("")
            .reduce((s, c) => (Math.imul(31, s) + c.charCodeAt(0)) | 0, 0);
  }

  #makeDragable() {
    // modify "this" and not "this.#root" since the whole element should be draggable and not the shadowRoot
    this.setAttribute("draggable", true);
    this.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("application/json", JSON.stringify(this.#data));
      e.dataTransfer.setData("text/uri-list", this.sourceURL());
      e.dataTransfer.setData("text/plain", this.sourceURL());
    });
  }

  /**
   * Appends child HTMLMediaElement.
   * This will have already been run if the constructor() was called with (mediaType != null).
   * If mediaType was not set, then appendMedia() must be called before the child HTMLMediaElement is loaded and before any of the media functions parameters will work.
   * @param {boolean|string|null} [type=true] If set to NULL or TRUE, then
   * @public
   */
  appendMedia(type) {
    if (!!this.#media && !!this.#media.id) return; // don't re-run if already done

    // if (type ==  || typeof type != "string") type = this.#data.mime;
    type ??= this.#data.mime || "audio"; // TODO is there a better fallback?
    let tag = type.split("/")[0];
    switch (tag) {
      case "audio":
      case "video":
        break;
      case "iframe":
      default:
        type = null;
        break;
    }

    this.#media = document.createElement(tag);
    this.#media.autoplay = false; // wait to play
    this.#media.controls = false; // no native controls
    this.#media.preload = "metadata";

    if (!this.#data.src || !Array.isArray(this.#data.src)) {
      this.#media.src = this.#data.url;
      if (!!type) this.#media.type = type;
    } else {
      this.#data.src.forEach((f) => {
        // append a source element for each URL/MIME-type
        const source = document.createElement("source");
        source.src = f.url || f.src;
        source.type = f.mime;
        this.#media.appendChild(source); // append to the media element
      });
    }

    // if there's a start time, then seek to it
    if (this.#data?.start > 0) this.seekTo(this.#data.start);
    this.#media.id = `play-${this.sourceID}`;

    this.#root.appendChild(this.#media);
  }

  /**
   * Gets the ID
   * @returns {string}
   */
  get sourceID() {
    return this.#data?.id || null;
  }
  /** Gets the source URL
   * @returns {string}
   * @example "https://amplfr.com/"
   */
  get sourceURL() {
    return this.#data?.url || this.src || null;
  }
  /**
   * Gets the domain from the source URL
   * @returns {string}
   * @example "amplfr"
   */
  get domain() {
    return this.#data?.domain || null;
  }
  /**
   * @see artists
   */
  get artist() {
    return this.artists;
  }
  /**
   * Gets the artists
   * @returns {string[]|null}
   */
  get artists() {
    return this.#data?.artists || null;
  }

  // media controls
  /**
   * Plays the media.
   * @see {@link appendMedia} for loading the media
   */
  // prettier-ignore
  play() { this.#media?.play() }
  /**
   * Pauses the media.
   * @see {@link appendMedia} for loading the media
   */
  // prettier-ignore
  pause() { this.#media?.pause() }
  /**
   * Stops the media.
   * Equivilent to {@link pause} and {@link seekTo}(0)
   * @see {@link appendMedia} for loading the media
   */
  stop() {
    this.#media?.pause();
    this.fastSeek(this.#data?.start || 0); // reset the time back to beginning
  }
  /**
   * Fast seeks to the specified time.
   * @param {number} s The time to seek to in seconds (float or integer).
   * @see {@link seekTo}
   * @see {@link appendMedia} for loading the media
   */
  // prettier-ignore
  fastSeek(s) { this.seekTo(s, false) }
  /**
   * Seeks to the specified time.
   * @param {number} s The time to seek to in seconds (float or integer).
   * If less than 0, will seek to start time or 0. If greater than the duration, will seek to end time or (duration).
   * @param {boolean} [precise=FALSE] If true uses the more precise currentTime, otherwise use fastSeek
   * @see {@link appendMedia} for loading the media
   */
  seekTo(s, precise = false) {
    if (!this.#media) return;

    let startTime = this.#data.start || 0;
    let endTime = this.#data.end || this.duration || 0;
    s = Math.max(startTime, Math.min(s, endTime)); // keep s within known range

    if (!precise) this.#media?.fastSeek(s); // faster (??)
    else this.#media.currentTime = s; // more precise
  }

  // media property set'ers
  /**
   * Seeks to the specified time.
   * @param {number} v The time to seek to in seconds (float or integer).
   * @see {@link seekTo}
   * @see {@link appendMedia} for loading the media
   */
  // prettier-ignore
  set currentTime(v) { this.seekTo(v, true); }
  /**
   * Fast seeks to the specified time.
   * @param {number|boolean} [v=!loop] The number of times to loop through all of the items, true to loop indefinitely, or false to not loop again.
   * @see {@link appendMedia} for loading the media
   */
  set loopAll(v = !this.loopAll) {
    if (!this.#media) return;

    this.#media.loop = !!v;
    if (typeof v == "number") {
      this.#loopCounter = Math.min(1, v); // save the number of times to loop (>=0)
      this.#media?.addEventListener("ended", this.#decrementLoops);
      if (v <= 0) this.#decrementLoops();
    }
  }
  #decrementLoops = (e) => {
    --this.#loopCounter; // one less time to loop

    // no more looping
    if (this.#loopCounter <= 0) {
      this.#loopCounter = 0;
      this.#media.loop = false;
      this.#media.removeEventListener("ended", this.#decrementLoops);
    }
  };
  // prettier-ignore
  set muted(v=!this.muted) { if (!!this.#media) this.#media.muted = (!!v) }
  // prettier-ignore
  set playbackRate(v=1) { if (!!this.#media) this.#media.playbackRate = v }
  // prettier-ignore
  set volume(v=1) { if (!!this.#media) this.#media.volume = v }

  // media property get'ers - each returns null if this.#media is null
  // prettier-ignore
  get currentTime() { return this.#media?.currentTime || null }
  // prettier-ignore
  get duration() { return this.#media?.duration || null }
  // prettier-ignore
  get ended() { return this.#media?.ended || null }
  // prettier-ignore
  get loop() { return this.#media?.loop || null }
  // prettier-ignore
  get muted() { return this.#media?.muted || null }
  // prettier-ignore
  get networkState() { return this.#media?.networkState || null }
  // prettier-ignore
  get paused() { return this.#media?.paused || null }
  // prettier-ignore
  get playbackRate() { return this.#media?.playbackRate || null }
  // prettier-ignore
  get readyState() { return this.#media?.readyState || null }
  // prettier-ignore
  get seekable() { return this.#media?.seekable || null }
  // prettier-ignore
  get volume() { return this.#media?.volume || null }

  addEventListener(type, listener, options) {
    const mediaListeners = [
      "abort",
      "canplay",
      "canplaythrough",
      "durationchange",
      "emptied",
      "ended",
      "error",
      "loadeddata",
      "loadedmetadata",
      "loadstart",
      "pause",
      "play",
      "playing",
      "progress",
      "ratechange",
      "resize",
      "seeked",
      "seeking",
      "stalled",
      "suspend",
      "timeupdate",
      "volumechange",
      "waiting",
    ];

    if (mediaListeners.includes(type))
      this.#media.addEventListener(type, listener, options);
    // else this.addEventListener(type, listener, options)
  }

  /**
   * connectedCallback() is called when this element is (re-)added to the DOM
   */
  async connectedCallback() {
    if (this.#isBuilt == true) return; // no need to build again if already done

    await this.#populate();

    // start the build
    if (this.#useShadow) this.#root = document.createElement("div");
    else this.#root = this;

    this.#root.setAttribute("class", "item");
    this.#root.dataset.id = this.domain + "=" + this.#data.id;

    this.appendArtwork(); // handle special case artwork
    this.appendChildTags();
    this.appendArtists(); // handle special case artists

    this.#isBuilt = true; // get here, and there's no need to run again

    // if this.#mediaType isn't deferred (NULL), call appendMedia(this.#mediaType) now
    if (!!this.#mediaType) this.appendMedia(this.#mediaType);

    // finishing touches
    this.#root.setAttribute("title", this.#data.title);
    this.#makeDragable(); // make it dragable

    // finish up the build
    if (!this.#useShadow || !!this.shadowRoot) return;
    const shadow = this.attachShadow({ mode: "open" }); // Create a shadow root

    // Apply external styles to the shadow dom
    const linkElem = document.createElement("link");
    linkElem.setAttribute("rel", "stylesheet");
    linkElem.setAttribute("href", `/css/item.css`);

    // Attach the created elements to the shadow dom
    shadow.appendChild(linkElem);
    shadow.appendChild(this.#root);
  }

  disconnectedCallback() {}

  adoptedCallback() {}

  attributeChangedCallback(name, oldValue, newValue) {}

  appendArtwork() {
    // if (!this.#data.artwork) return;
    // const artwork = this.#data.artwork;
    const artwork =
      this.#data?.artwork ||
      "/albumart/" + (this.#data.albumid || `item/${this.#data.id}`) + ".jpg";
    if (!artwork || artwork.indexOf("undefined") > -1) return;

    const e = document.createElement("div");
    e.setAttribute("class", "artwork");
    e.setAttribute("tabindex", 0);
    e.style.backgroundImage = `url(${artwork})`;

    return this.#root.appendChild(e);
  }
  appendArtists() {
    const artists = this.#data.artists;
    if (!artists || !Array.isArray(artists) || artists?.length < 1) return;

    const e = document.createElement("div");
    e.setAttribute("class", "artists");

    // prettier-ignore
    // if every artist is a string
    if (artists.every((artist) => { typeof artist == "string"; }))
      // then just join() them all into one delimited string
      e.textContent = artists.join(", ");
    else {
      // create a child element for each Artist, populate it, and append it to e
      const attributes = ["name", "area", "started", "ended", "id", "url"];
      artists.forEach((artist) => {
        const child = document.createElement("span");
        
        if (typeof artist != "string") {
          // assign child's dataset from this artist's attributes
          assignDataset(child.dataset, artist, attributes);
          
          if (!!artist.id) child.dataset.id = `artist-${artist.id}`;
        }
        child.textContent = artist.name || artist;
        
        e.appendChild(child);
      });
    }

    return this.#root.appendChild(e);
  }
  appendChildTags() {
    if (!this.#childTags) return;
    const childTags = this.#childTags;
    const data = this.#data;

    // list of additional child tags to populate
    return childTags.map((tag) => {
      if (!!data[tag]) {
        const e = document.createElement("div");
        const text = data[tag];

        // Take attribute content and save it to root's dataset, and inside the childElement div
        this.#root.dataset[tag] = text;
        e.textContent = text;
        e.setAttribute("class", tag);

        return this.#root.appendChild(e);
      }
    });
  }
}
customElements.define("amplfr-item", AmplfrItem, { extends: "div" });

/**
 * AmplfrCollection is an HTML element comprised of a list of {@link AmplfrItem}s.
 * @name AmplfrCollection
 * @see {@link AmplfrItem}
 * @extends AmplfrItem
 * @inheritdoc
 */
// class AmplfrCollection extends HTMLDivElement {
class AmplfrCollection extends AmplfrItem {
  #useShadow = false; // toggle if resulting elements should go in shadow DOM instead
  #data; // holds internal data object
  #items; // holds the items' IDs
  #itemNumber;
  #current; // which item is currently selected/playing
  #root; // the root HTML element
  #loop;
  #isBuilt;

  /**
   * @param {CollectionSourceData|ItemSourceData[]|string|string[]|null} data Source URL(s), data object(s) used to populate this. Can be one of the following:
   *  - CollectionSourceData object
   *  - ItemSourceData[] - list of ItemSourceData objects
   *  - string - Collection URL
   *  - string[] - list of item URLs, either an array or string of whitespace-separated URLs.
   *  - NULL - will use the element's dataset (as CollectionSourceData) or src (as URL to parse) attributes.
   */
  constructor(data) {
    super(); // Always call super first in constructor

    this.#data = {};
    this.#items = [];
    // this.#childTags = ["title", "collection"];

    // only if this object is an AmplfrCollection vs some extended class
    if (this instanceof AmplfrCollection) {
      if (typeof data == "string") {
        // if data has any whitespace characters (a URL should not)
        //  then split on each whitespace character and save each token as an item
        if (/\s/.test(data)) this.#data.items = data.split(/\s/);
        // if data is a string, hopefully it's a URL (under 2083 characters) with additional data
        else if (data.length <= 2083) {
          this.src = data; // save the URL
          this.#data = this.#parse(this.src); // fetch the URL, saving the promise
        }
      } else if (typeof data == "array") {
        this.#data.items = data;
      } else this.#populate(data);
    }
  }

  /**
   * Fetches the given URL, parses the received media file, and returns an object with the extracted metadata.
   * The return object can be used as input for #populate().
   * @param {string} [url] The URL endpoint/file to fetch and parse.
   * @returns {CollectionSourceData}
   */
  async #parse(url) {
    if (!url && !!this.src) url = this.src; // use src

    let obj;
    let urlObj;
    try {
      // if url is actually a URL, then fetch(url) and save the results
      urlObj = new URL(url);
      this.#data.domain = urlObj.hostname.replace(/www\.|m\./, "");
      this.#data.url = urlObj;
    } catch (error) {
      // url isn't a URL
      urlObj = null;
      this.#data.domain = "";
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
          if (mime === "application/json") return await response.json();

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
              return this.#parseM3U(urlObj, text);
              break;

            default: // split by whitespace into separate items
              break;
          }
        }
      }
    } catch (error) {}
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
  #parseM3U(urlObj, text) {
    const lines = text.split(/\n|\r\n/); // break text into separate lines
    let obj;

    // confirm that the first line has the required string "#EXTM3U"
    if (!lines[0].test(/^#EXTM3U/i)) return null;
    lines.shift(); // remove the first line

    urlObj = urlObj.toString();
    let baseUrl = urlObj.substring(0, urlObj.lastIndexOf("/")) + "/";

    let line;
    obj.items = [];
    for (n = 0; n < lines.length; n++) {
      line = lines[n];
      if (line.test(/^\s*$/)) continue; // skip any "blank" lines

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
          } catch (error) {}

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
          } catch (error) {}
      }
    }

    return obj;
  }

  /**
   *
   */
  async #populate(obj) {
    if (!!this.#data) {
      // was this.#parse(URL) called in the constructor?
      if (this.#data.then) {
        obj = await this.#data; // await for the Promise to resolve
        this.#data = {}; // reset #data object
      }
    }

    // check if there's enough data already provided
    if (!obj) {
      if (!!this.dataset) obj = this.dataset; // use dataset
      else if (!!this.src) obj = this.src; // use src
      else return; // nothing else to do here
    }

    // if obj is a string, hopefully it's a URL (under 2083 characters) with additional data
    if (typeof obj == "string" && obj.length <= 2083) {
      let url = obj;
      obj = await this.#parse(url);
    }

    // pull out all of the "string" keys from obj, saving to this.dataset
    const keys = ["id", "url", "title", "artwork", "items", "start", "end"];
    keys.forEach((k) => {
      if (!!obj[k] && typeof obj[k] == "string") this.#data[k] = obj[k];
    });

    // add the obj.artists (or obj.artist) to a flattened array
    if (!!obj.artists || !!obj.artist)
      this.#data.artists = new Array(...obj.artists, ...obj.artist).flat();

    if (Array.isArray(obj)) this.#data.items = obj; // if obj is an array, save it as list of items

    this.title = this.#data?.title;

    // set needed fields that may not be set yet
    let url = this.#data?.url || this.src;
    if (!!url) {
      try {
        this.#data.url = new URL(url);
      } catch (err) {}
      this.src = this.#data?.url.href || url;
      this.#data.domain =
        this.#data.domain || this.#data?.url.hostname.replace(/www\.|m\./, "");
    }
    if (!this.#data.id)
      // from https://gist.github.com/hyamamoto/fd435505d29ebfa3d9716fd2be8d42f0?permalink_comment_id=4261728#gistcomment-4261728
      this.#data.id =
        this.#data.id ||
        `${this.domain}-` +
          `${this.#data.url.pathname}${this.#data.url.search}`
            .split("")
            .reduce((s, c) => (Math.imul(31, s) + c.charCodeAt(0)) | 0, 0);
  }

  #makeDragable() {
    this.#root.setAttribute("draggable", true);
    this.#root.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("application/json", JSON.stringify(this.#data));
      e.dataTransfer.setData("text/uri-list", this.sourceURL());
      e.dataTransfer.setData("text/plain", this.sourceURL());
    });
  }

  appendItems() {
    const items = this.#data.items;
    if (!items || items.length < 1) return;

    const e = document.createElement("ol");
    e.setAttribute("class", "items");

    // create a child element for each item, populate it, and append it to e
    items.forEach((item) => {
      const li = document.createElement("li");
      const child = new AmplfrItem(item); // created with class 'item'

      li.appendChild(child);
      e.appendChild(li);
    });
    this.item = 1; // select the first item

    this.#root.appendChild(e);
  }

  /**
   * Appends child HTMLMediaElement for the current item.
   * @param {string} [type='audio']
   */
  // prettier-ignore
  async appendMedia(type) { this.#current.appendMedia(type); }

  // prettier-ignore
  get sourceID() { return `${this.domain}-${this.#data?.id}`; }
  // prettier-ignore
  get domain() { return this.#data.domain || null; }
  // prettier-ignore
  get artist() { return this.artists }
  // prettier-ignore
  get artists() { return this.#data?.artists || null }
  // prettier -ignore
  // get items() { return this.#items || null }
  get items() {
    if (!this.#items) this.#items = this.#root.querySelectorAll(".item"); // save all of the items

    return this.#items;
  }
  // prettier-ignore
  get item() { return this.#itemNumber; }
  // prettier-ignore
  get track() { return this.#itemNumber; }

  // collection controls
  /**
   * Sets the current item
   * @param {number} i The index of the item to select.
   */
  set item(i) {
    if (i == this.#itemNumber) return; // nothing to do if already set to this.#itemNumber

    const playing = this.paused === false ? true : false; // ==false means its playing, but null means nothing
    if (playing === true) this.pause();

    if (i <= 0) i = this.#items.length + i; // zero or negative values count back from the last item
    i = Math.max(1, Math.min(i, this.#items.length)); // keep i in range
    this.#itemNumber = i;
    // this.#current = this.#items[i - 1];
    this.#current = this.items[i - 1];

    if (!this.#current) return; // if #current is bad, just quit

    this.#current.appendMedia(); // ensure that #current's media is ready

    // start playing the new item if previous item was playing
    if (playing === true) this.play();

    // if #current is the last item and this.loop is false
    if (
      this.#itemNumber == this.#items.length - 1 &&
      !this.loop
    ) {
        // create and dispatch an 'ended' event
        const ev = new Event('ended')
        this.dispatchEvent(ev)
    }
    // prettier-ignore
    // add 'ended' event to go to the next() item
    else this.#current.addEventListener("ended", this.next(), { once: true });
  }
  // prettier-ignore
  set track(i) { this.item(i) }
  // prettier-ignore
  next() { this.item((this.#itemNumber || 0) + 1); }
  // prettier-ignore
  previous() { this.item(this.#itemNumber - 1 || 0); }
  // prettier-ignore
  set loop(v=!this.#loop) { this.#loop = !!v; }
  // prettier-ignore
  set muted(v=!this.muted) { if (!!this.#current) this.#current.muted = !!v; }
  // prettier-ignore
  set volume(v=1) { if (!!this.#current) this.#current.volume = v; }

  // prettier-ignore
  get duration() { return this.#current?.duration || null }
  // prettier-ignore
  get ended() { return this.#current?.ended || null }
  // prettier-ignore
  get loop() { return this.#current?.loop || null }
  // prettier-ignore
  get muted() { return this.#current?.muted || null }
  // prettier-ignore
  get volume() { return this.#current?.volume || null }

  // media controls - mapped to this.#current item
  play(i = this.#itemNumber) {
    if (i !== this.#itemNumber) this.item = i;
    this.#current?.play();
  }
  // prettier-ignore
  pause() { this.#current?.pause() }
  stop() {
    // (safely) call this.#current.stop() in case it isn't defined in this.#current
    try {
      this.#current.stop();
    } catch (error) {
      // just pause() and then reset the time
      this.#current?.pause();
      this.#current?.fastSeek(0);
    }
  }
  // prettier-ignore
  fastSeek(s) { this.#current?.fastSeek(s); }
  // prettier-ignore
  seekTo(s, precise) { this.#current?.seekTo(s, precise); }

  // media property set'ers - mapped to this.#current item
  // prettier-ignore
  set currentTime(v) { this.#current?.currentTime(v); }
  // prettier-ignore
  set playbackRate(v=1) { if (!!this.#current) this.#current.playbackRate = v; }

  // media property get'ers - each returns null if this.#media is null
  // prettier-ignore
  get currentTime() { return this.#current?.currentTime || null }
  // prettier-ignore
  get networkState() { return this.#current?.networkState || null }
  // prettier-ignore
  get paused() { return this.#current?.paused || null }
  // prettier-ignore
  get playbackRate() { return this.#current?.playbackRate || null }
  // prettier-ignore
  get readyState() { return this.#current?.readyState || null }
  // prettier-ignore
  get seekable() { return this.#current?.seekable || null }

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
  //     this.#media.addEventListener(type, listener, options);
  //   // else this.addEventListener(type, listener, options)
  // }

  /**
   * connectedCallback() is called when this element is (re-)added to the DOM
   */
  async connectedCallback() {
    if (this.#isBuilt == true) return; // no need to build again if already done

    await this.#populate();

    // start the build
    if (this.#useShadow) this.#root = document.createElement("div");
    else this.#root = this;

    this.#root.setAttribute("class", "collection");
    this.#root.dataset.id = this.domain + "=" + this.#data.id;

    this.appendArtwork(); // handle special case artwork
    this.appendChildTags();
    // this.appendArtists(); // handle special case artists
    this.appendItems(); // handle special case items

    this.#isBuilt = true; // get here, and there's no need to run again

    // if this.#mediaType isn't deferred (NULL), call appendMedia(this.#mediaType) now
    // if (!!this.#mediaType) this.appendMedia(this.#mediaType);

    // finishing touches
    this.#root.setAttribute("title", this.#data.title);
    this.#makeDragable(); // make it dragable

    // finish up the build
    if (!this.#useShadow || !this.shadowRoot) return;
    const shadow = this.attachShadow({ mode: "open" }); // Create a shadow root

    // Apply external styles to the shadow dom
    const linkElem = document.createElement("link");
    linkElem.setAttribute("rel", "stylesheet");
    linkElem.setAttribute("href", `/css/collection.css`);

    // Attach the created elements to the shadow dom
    shadow.appendChild(linkElem);
    shadow.appendChild(this.#root);

    // once the items and the OL have been appended
    this.#items = this.#root.querySelectorAll(".item"); // save all of the items
  }
}
// prettier-ignore
customElements.define("amplfr-collection", AmplfrCollection, { extends: "div" });
