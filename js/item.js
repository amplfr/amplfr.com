/**
 * Data fields needed to build a AmplfrItem
 * @typedef {object} ItemSourceData
 * @property {string} url - Canonical URL for the item.
 * @property {string} title - Title of the item.
 * @property {string|string[]} [artists] - Artist(s) that made the item.
 * @property {string} [artwork] - URL for artwork. If not specified, attempts to extract image from the media file the URL points at.
 * @property {string} [mime] - The MIME type of the media file. If not specified, attempts to extract the MIME type of the media file the URL points at.
 * @property {Number} [start=0.0] - Time (in seconds) to start playback.
 * @property {Number} [end=NULL] - Time (in seconds) to end playback.
 */

/**
 * Fetches the given URL, parses the received media file, and returns an object with the extracted metadata.
 * The return object can be used as input for #populate().
 * @param {string} [url] The URL endpoint/file to fetch and parse. Only works if the result is a media file with metadata.
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
 * @returns {ItemSourceData}
 */
const parseAmplfr = async (url) => {
  if (!url && !!this.src) url = this.src; // use src

  const response = await fetch(url);
  let obj = await response.json();

  obj = {
    id: obj.id,
    title: obj.title,
    artists: obj.artists,
    artwork: "/artwork/" + (obj.albumid ?? `item/${obj.id}`),
    url: obj.url,
  };

  // get the list of media files
  const fetchFiles = await fetch(`/api/${obj.id}.files`);
  const files = await fetchFiles.json();
  obj.src = files
    // return the list media that client might be able to play
    .filter((f) => media.canPlayType(f.mime || f) !== "")
    // TODO sort by bitrate, and *then* by what's playable
    .sort((a, b) => {
      // prefer media files that are playable by client
      const map = {
        probably: 1,
        maybe: 2,
        "": 3,
      };

      if (map[a] < map[b]) return -1;
      else if (map[a] > map[b]) return 1;
      else return 0;
    });

  return obj;
};
const validAmplfrID =
  /[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{22}/;

/**
 * AmplfrItem is an HTML element created from a URL, comprised of the related Title, Artist(s), and other metadata.
 */
class AmplfrItem extends HTMLDivElement {
  #useShadow = true; // toggle if resulting elements should go in shadow DOM instead
  #data; // holds internal data object
  #functions; // functions for supported specific domains

  /**
   * @param {ItemSourceData|string|null} data ItemSourceData object or URL to populate the element. Using a null value will use the element's dataset or src attributes.
   * @param {string|boolean|null} [mediaType] "Audio" or "video" to indicate the type to be used for the child HTMLMediaElement created as part of creating this when added to the DOM.
   * If non-null value is given, then the child HTMLMediaElement will be created until buildMedia() is called.
   * If null (default) value is used, then the child HTMLMediaElement will not be created until buildMedia() is called.
   */
  constructor(data, mediaType = null) {
    super(); // Always call super first in constructor

    this.#data = {};
    this.#mediaType = mediaType;

    this.#populate(data);
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
      // in case url wasn't a real URL
      this.#data.domain = url;
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
          url = `//amplfr.com/api/${url}.json`;
          obj = parseAmplfr(url); // parse url as a Amplfr URL
          break;
        }

        obj = parseURL(url);
        break;
    }

    let { searchParams } = new URL(url);
    obj.start = searchParams["s"] || !!searchParams["start"] || undefined;
    obj.end = searchParams["e"] || !!searchParams["end"] || undefined;

    return obj;
  }
  /**
   *
   */
  async #populate(obj) {
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
    if (!!obj.dataset) obj = obj.dataset;

    // pull out all of the "string" keys from obj, saving to this.dataset
    const keys = ["id", "url", "title", "artwork", "src", "start", "end"];
    keys.forEach((k) => {
      if (!!obj[k] && typeof obj[k] == "string") this.#data[k] = obj[k];
    });

    // add the obj.artists (or obj.artist) to a flattened array
    if (!!obj.artists || !!obj.artist)
      this.#data.artists = new Array(...obj.artists, ...obj.artist).flat();

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

  /**
   * Appends child HTMLMediaElement.
   * This will have already been run if the constructor() was called with (mediaType != null).
   * If mediaType was not set, then buildMedia() must be called before the child HTMLMediaElement is loaded and before any of the media functions parameters will work.
   * @param {boolean|string|null} [type=true] If set to NULL or TRUE, then
   * @returns
   */
  async buildMedia(type) {
    if (!!this.#media && !!this.#media.id) return; // don't re-run if already done

    // if (type ==  || typeof type != "string") type = this.#data.mime;
    type ??= this.#data.mime;
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

    this.#root.appendChild(this.#media);
    this.#media.id = `play-${this.sourceID}`;
  }

  #startBuild() {
    if (this.#useShadow) this.#root = document.createElement("div");
    else this.#root = this;

    root.setAttribute("class", "item");
    root.dataset.id = this.domain + "=" + this.#data.id;
  }
  #buildArtwork() {
    if (!this.#data.artwork) return;

    const e = document.createElement("div");
    e.setAttribute("class", "artwork");
    e.setAttribute("tabindex", 0);
    e.style.backgroundImage = `url(${this.#data.artwork})`;

    this.#root.appendChild(e);
  }
  #buildArtists() {
    const artists = this.#data.artists;
    if (!artists || artists.length < 1) return;

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
          this.#assignDataset(child.dataset, artist, attributes);
          
          if (!!artist.id) child.dataset.id = `artist-${artist.id}`;
        }
        child.textContent = artist.name || artist;
        
        e.appendChild(child);
      });
    }

    this.#root.appendChild(e);
  }
  #buildChildTags(childTags) {
    // list of additional child tags to populate
    childTags.forEach(function (tag, t, arr) {
      if (!!this.#data[tag]) {
        const e = document.createElement("div");
        const text = this.#data[tag];

        // Take attribute content and save it to root's dataset, and inside the childElement div
        // root.dataset[tag] = text;
        e.textContent = text;
        e.setAttribute("class", tag);

        this.#root.appendChild(e);
      }
    }, this);
  }
  #finishBuild() {
    if (this.#useShadow) return;
    const shadow = this.attachShadow({ mode: "open" }); // Create a shadow root

    // Apply external styles to the shadow dom
    const linkElem = document.createElement("link");
    linkElem.setAttribute("rel", "stylesheet");
    linkElem.setAttribute("href", `/css/item.css`);

    // Attach the created elements to the shadow dom
    shadow.appendChild(linkElem);
    shadow.appendChild(this.#root);
  }
  #makeDragable() {
    this.#root.setAttribute("draggable", true);
    this.#root.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("application/json", JSON.stringify(this.#data));
      e.dataTransfer.setData("text/uri-list", this.sourceURL());
      e.dataTransfer.setData("text/plain", this.sourceURL());
    });
  }

  // prettier-ignore
  get sourceID() { return this.#data.id; }
  // prettier-ignore
  get sourceURL() { return this.#data?.url || this.src; }
  // prettier-ignore
  get domain() { return this.#data.domain; }
  // prettier-ignore
  get artist() { return this.artists }
  // prettier-ignore
  get artists() { return this.#data?.artists || null }

  // media controls
  // prettier-ignore
  play() { this.#media?.play() }
  // prettier-ignore
  pause() { this.#media?.pause() }
  stop() {
    this.#media?.pause();
    this.fastSeek(this.#data?.start || 0); // reset the time back to beginning
  }
  // prettier-ignore
  fastSeek(s) { this.seekTo(s, false) }
  seekTo(s, precise = false) {
    if (!this.#media) return;

    let endTime = this.#data?.end || this.duration || 0;
    s = Math.max(0, Math.min(s, endTime)); // keep s within known range

    if (precise) this.#media.currentTime = s; // more precise
    else this.#media?.fastSeek(s); // faster (??)
  }

  // media property set'ers
  // prettier-ignore
  set currentTime(v) { this.seekTo(v, true); }
  set loop(v = !this.loop) {
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
    mediaListeners = [
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
    this.#startBuild();

    this.#buildArtwork(); // handle special case artwork
    this.#buildChildTags(["title", "collection"]);
    this.#buildArtists(); // handle special case artists

    this.#isBuilt = true; // get here, and there's no need to run again

    // if this.#mediaType isn't deferred (NULL), call buildMedia(this.#mediaType) now
    if (!!this.#mediaType) this.buildMedia(this.#mediaType);

    // finishing touches
    this.#root.setAttribute("title", this.#data.title);
    this.#makeDragable(); // make it dragable
    this.#finishBuild();
  }

  disconnectedCallback() {}

  adoptedCallback() {}

  attributeChangedCallback(name, oldValue, newValue) {}

  #assignDataset(datasetObj, obj, keys = null) {
    keys = keys || Object.keys(obj);
    keys.forEach((k) => {
      if (!!obj[k]) datasetObj[k] = obj[k];
    });
  }
}

customElements.define("amplfr-item", AmplfrItem, { extends: "div" });
