Number.prototype.toMMSS = function () {
  if (Number.isNaN(this.valueOf())) return "";
  let neg = this < 0 ? "-" : "";
  let t = Math.abs(this);
  let s = Math.round(t % 60);
  let m = Math.floor(t / 60);

  if (m >= 60) m = `${m / 60}:${(m % 60).toString().padStart(2, "0")}`;
  return `${neg}${m}:${s.toString().padStart(2, "0")}`;
};
Number.prototype.toHumanBytes = function () {
  if (Number.isNaN(this.valueOf())) return "";

  // based on https://gist.github.com/zentala/1e6f72438796d74531803cc3833c039c
  if (this == 0) return "0B";
  const k = 1024;
  const dm = 2;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(this) / Math.log(k));

  return parseFloat((this / Math.pow(k, i)).toFixed(dm)) + sizes[i];
};

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

const assignDataset = (datasetObj, obj, keys = null) => {
  keys = keys || Object.keys(obj);
  keys.forEach((k) => {
    if (!!obj[k]) datasetObj[k] = obj[k];
  });
};

/**
 * Fetches the given URL, parses the received media file, and returns an object with the extracted metadata.
 * The return object can be used as input for _populate().
 * @param {string} [url] The URL endpoint/file to fetch and parse. Only works if the result is a media file with metadata.
 * @private
 * @returns {ItemSourceData}
 */
const parseURL = async (url) => {
  // TODO need to pull in https://github.com/Borewit/music-metadata-browser
  // const mm = import(https://github.com/Borewit/music-metadata-browser)
  let src = new URL(url, document.location);
  src = src.toString();
  const response = await fetch(src);
  const bytes = parseInt(response.headers.get("Content-Length"), 10);
  const mime = response.headers.get("Content-Type");
  let obj = {
    // default the title to the filename minus dashes, etc.
    title: url.split("/").pop().split(".")[0].replace(/[-_]/g, " "),
    src: [
      {
        mime,
        bytes,
        url: src.toString(),
      },
    ],
    url,
  };

  // if JSMediaTags is available, then use it to extract the needed ID3v2 tags
  if (!!window.jsmediatags) {
    // call jsmediatags as a Promise
    const jsmediatagsPromise = async (src) =>
      await new Promise((resolve, reject) => {
        new window.jsmediatags.Reader(src)
          .setTagsToRead(["album", "artist", "picture", "title", "year"])
          .read({
            onSuccess: (tag) => resolve(tag),
            onError: (err) => reject(err),
          });
      });

    // await for jsmediatagsPromise() to finish
    try {
      let { tags } = await jsmediatagsPromise(src);

      if (!!tags.title) obj.title = tags.title;
      if (!!tags.artist) obj.artist = tags.artist;
      if (!!tags.album) obj.album = tags.album;
      if (!!tags.year) obj.year = tags.year;
      if (!!tags.picture) {
        // convert the picture to a Data URL for the obj.artwork
        const { data, format } = tags.picture;
        let base64String = "";
        for (let i = 0; i < data.length; i++)
          base64String += String.fromCharCode(data[i]); // convert each UTF-16 byte to ASCII character
        obj.artwork = `data:${format};base64,${window.btoa(base64String)}`;
      }
    } catch (err) {
      console.warn(err);
    }
  }

  return obj;
};

/**
 * @typedef AmplfrItemOptions
 * @property {boolean} [controls=true] Whether to display play/pause control
 * @property {logo} [logo=true] Whether to display the logo
 */

/**
 * AmplfrItem is an HTML element created from a URL or {@link ItemSourceData}, comprised of the related Title, Artist(s), and other metadata.
 * @name AmplfrItem
 * @class
 * @extends {HTMLDivElement}
 */
class AmplfrItem extends HTMLDivElement {
  _data; // holds internal data object
  _options; // holds options and internal parameters

  /**
   * @constructor
   * @param {ItemSourceData|string|null} data ItemSourceData object or URL to populate the element. Using a null value will use the element's dataset or src attributes.
   * @param {AmplfrItemOptions|boolean|null} [mediaType] "Audio" or "video" to indicate the type to be used for the child HTMLMediaElement created as part of creating this when added to the DOM.
   * If non-null value is given, then the child HTMLMediaElement will be created once added to the DOM - e.g., document.body.appendChild(AmplfrItem).
   * If null (default) value is used, then the child HTMLMediaElement will not be created until appendMedia() is called.
   */
  constructor(data, options = false) {
    super(); // Always call super first in constructor

    if (!(this instanceof AmplfrItem) || data === false) return

    this._data = {};
    this._options = {
      useShadow: false, // toggle if resulting elements should go in shadow DOM instead
      controls: {}, // use an object instead of boolean for easy access to controls later
      standalone: true, // set to false if this is part of an AmplfrCollection
      // mediaType: options?.media || options, // defaults to null
      childTags: ["title", "collection"],
      class: 'amplfr-item',
    };
    if (options.controls != null) this._options.controls = options?.controls;
    if (options.logo != null) this._options.logo = options?.logo;
    if (options.standalone != null)
      this._options.standalone = options?.standalone;
    if (options.mediaType != null || typeof options == "boolean")
      this._options.mediaType = options?.media || options;

    if (typeof data !== "string") {
      this._populate(data);
      return
    }

    if (data.indexOf('{') > -1) {
      let obj
      try {
        obj = JSON.parse(decodeURI(data))
        this._populate(obj)
        return
      } catch (err) {
        console.warn(err)
      }
    }

    this._data = AmplfrItem.parse(data); // fetch the URL, saving the promise
  }

  static isValidID(text) {
    return typeof text == "string" && /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{22}$/.test(text)
  }
  /**
   * Fetches the given URL, parses the received media file, and returns an object with the extracted metadata.
   * The return object can be used as input for _populate().
   * @param {string} [url] The URL endpoint/file to fetch and parse.
   * @returns {ItemSourceData}
   */
  static async parse(url) {
    if (!url && !!this.src) url = this.src; // use src

    let domain, id;
    let urlObj;
    // try to slice up the URL and save the domain part
    try {
      urlObj = new URL(url);
      domain = urlObj.hostname.replace(/www\.|m\./, "");
    } catch (err) {
      domain = url; // in case url wasn't a real URL
    } finally {
      [domain, id] = domain.split('/')
    }

    // check if domain is just an AmplfrID
    if (AmplfrItem.isValidID(url)) {
      domain = 'amplfr'
      url = document.location.origin + `/api/${url}.json`
    }

    let obj;
    switch (domain) {
      case "localhost":
      case "amplfr":
      case "amplfr.com":
        // let { default: parseAmplfr } = await import('./parseAmplfr.js')
        let { parseAmplfr } = await import('./parseAmplfr.js')
        // if (!parseAmplfr) ({ parseAmplfr } = await import('./parseAmplfr.js'))
        obj = parseAmplfr(url);
        break;
      default:
        obj = parseURL(url);
        break;
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
      }
    }

    // check if there's enough data already provided
    const dataset = Array.from(this.dataset);
    if (!source) {
      if (dataset.length > 0) source = dataset; // use dataset
      else if (typeof this.src == "string" && this.src != "")
        source = await AmplfrItem.parse(this.src); // use src
      else return; // nothing else to do here
    }

    // pull out all of the "string" keys from obj, saving to this.dataset
    const keys = ["id", "src", "url", "href", "title", "artwork", "album", "albumid", "start", "end"];
    keys.forEach((k) => {
      if (!!source[k] && typeof source[k] == "string")
        this._data[k] = source[k];
    });

    // add the obj.artists (or obj.artist) to a flattened array
    let artists = [];
    if (!!source.artists) artists.push(...source.artists);
    if (!!source.artist) artists.push(source.artist);
    if (artists.length > 0) this._data.artists = artists.flat();

    if (!!source.album) this._data.album = source.album; // if album exists, save it
    // if (!!source.href) this._data.href = source.href; // if href exists, save it
    // if (!!source.url) this._data.url = source.url; // if url exists, save it
    if (!!source.src) this._data.src = source.src; // if src exists, save it
    else {
      let { fetchSrc } = await import('./parseAmplfr.js')
      let { src } = await fetchSrc(source)
      this._data.src = src
    }

    // if URL exists, save it. fallback to src
    try {
      if (!!source.url || !!source.src)
        this._data.url = new URL(
          source.url || source.src,
          document.location.origin
        );
    } catch (err) {
      console.warn(err);
    }

    this.title = this._data?.title; // save the title as the title of the element
  }

  _makeDraggable() {
    // modify "this" and not "this._options.root" since the whole element should be draggable and not the shadowRoot
    this.setAttribute("draggable", true);
    this.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("application/json", JSON.stringify(this._data));
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
    if (!!this._options.media && !!this._options.media.id) return; // don't re-run if already done
    if (!this._options.isBuilt) {
      // if this hasn't been processed yet
      // save the given type, so appendMedia() *will* be run once processed
      this._options.mediaType = type || true;
      return; // quit for now
    }

    if (type === true) type = undefined; // can't leave type === true
    type ??= this._data.mime || "audio"; // TODO is there a better fallback?
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

    this._options.media = document.createElement(tag);
    this._options.media.autoplay = false; // wait to play
    this._options.media.controls = false; // no native controls
    this._options.media.preload = "metadata";
    this._options.media.setAttribute('crossorigin', 'anonymous')

    if (!this._data.src || !Array.isArray(this._data.src)) {
      this._options.media.src = this._data.src  // || this._data.url;
      if (!!type) this._options.media.type = type;
    } else {
      this._data.src.forEach((f) => {
        // append a source element for each URL/MIME-type
        const source = document.createElement("source");
        source.src = f.src || f.url;
        source.type = f.mime;
        this._options.media.appendChild(source); // append to the media element
      });
    }

    // if there's a start time, then seek to it
    if (this._data?.start > 0) this.seekTo(this._data.start);
    this._options.media.id = `play-${this.sourceID}`;

    this._options.root.appendChild(this._options.media);

    this.appendControls();

    const _this = this;
    const updateControl = (control, text, title) => {
      if (!!_this._options?.controls[control]) {
        _this._options.controls[control].innerHTML = text;
        _this._options.controls[control].title = title;
      }
    };
    const log = (msg) =>
      console.log(`${_this._options.media.currentSrc} - ${msg}`);
    const logprogress = (msg) => {
      let bytes = _this.bytes;
      let loaded = 0;
      let played = 0;
      // from https://stackoverflow.com/a/27466608
      if (!!_this.buffered.length) {
        loaded = (100 * _this.buffered.end(0)) / _this.duration;
        played = (100 * _this.currentTime) / _this.duration;
      }

      if (bytes > 0) msg += ` ${bytes.toHumanBytes()}\n`;
      if (bytes > 0) msg += ` ${((loaded / 100) * bytes).toHumanBytes()}`;
      msg += ` ${loaded.toFixed(0)}% loaded\n`;
      if (bytes > 0) msg += ` ${((played / 100) * bytes).toHumanBytes()}`;
      msg += ` ${played.toFixed(0)}% played`;

      log(msg);
    };
    const warn = (msg) => {
      console.warn(`${_this._options.media.currentSrc} - ${msg}`);
      // console.warn(msg);

      //
      updateControl("button", "report", `Warning: ${msg}`);
    };

    this._options.media.addEventListener("abort", (e) => warn("abort"));
    this._options.media.addEventListener("error", async (e) => {
      const media = e.currentTarget;
      // warn("error")
      // warn(
      //   `ERROR code ${media.error.code} - ${media.error.message}`
      // );

      if (media.networkState === media.NETWORK_NO_SOURCE)
        return warn(
          `\nCannot load the resource as given. \Please double check the URL and try again`
        );

      // MEDIA_ERR_ABORTED - User aborted
      // MEDIA_ERR_NETWORK - some kind of network error
      // MEDIA_ERR_DECODE - error while trying to decode
      // MEDIA_ERR_SRC_NOT_SUPPORTED - resource has been found to be unsuitable

      // check that the URL is okay
      const URL = media.currentSrc || media.src;
      let res;
      try {
        res = await fetch(URL, { method: "HEAD" });
      } catch (err) { }
      if (!res.ok)
        warn(
          `Cannot load "${URL}" (HTTP${res.status}: ${res.statusText}).\n` +
          `Please double check the URL and try again.`
        );
    });
    this._options.media.addEventListener("stalled", (e) => warn("stalled"));
    this._options.media.addEventListener("waiting", (e) => {
      warn("waiting")
      updateControl("button", "downloading", "Waiting");
    });

    // 1. loadstart       starting to load
    //    - does this mean HTTP 2xx result?
    // 2. durationchange  once enough is downloaded that the duration is known
    // 3. loadedmetadata  once enough is downloaded that the duration, dimensions (video only) and text tracks are known
    // 4. loadeddata      when data for the current frame is loaded, but not enough data to play next frame
    // 5. progress        downloading
    // 6. canplay         when the browser can start playing the specified audio/video (when it has buffered enough to begin)
    // 7. canplaythrough  when the browser estimates it can play through the specified audio/video without having to stop for buffering
    this._options.media.addEventListener("canplay", (e) => {
      // log("canplay");
      updateControl("button", "play_arrow", `Play "${_this.title}"`);
    });
    // prettier-ignore
    this._options.media.addEventListener("canplaythrough", (e) => {
    });
    this._options.media.addEventListener("durationchange", (e) => {
      _this.#updateTime();
    });
    // this._options.media.addEventListener("emptied", (e) => log("emptied"));
    this._options.media.addEventListener("ended", (e) => {
      log("ended");
      if (!!_this._options?.standalone)
        updateControl("button", "replay", `Replay "${_this.title}"`);
    });
    // this._options.media.addEventListener("loadeddata", (e) => {});
    this._options.media.addEventListener("loadedmetadata", (e) => {
      _this.#updateTime();
    });
    this._options.media.addEventListener("loadstart", (e) => {
      if (e.currentTarget != _this._options.media) return;
      updateControl("button", "downloading", `Downloading "${_this.title}"`);

      // attempt a HEAD request for the media file to get its size
      // this is a best effort attempt, hence the .then()
      fetch(this._options.media.currentSrc, { method: "HEAD" })
        .then((res) => {
          if (res.ok) {
            // use either the Content-Range (total) or Content-Length header values
            let ContentRange = res.headers.get("Content-Range")?.split("/")[1]
            let ContentLength = res.headers.get("Content-Length")
            this._options.mediaBytes = parseInt(ContentRange ?? ContentLength)
          }
        })
        .catch((err) => console.warn(err.message || err));
    });
    this._options.media.addEventListener("pause", (e) => {
      if (e.currentTarget != _this._options.media) return;
      updateControl("button", "play_arrow", `Play "${_this.title}"`);
    });
    this._options.media.addEventListener("play", (e) => {
      if (e.currentTarget != _this._options.media) return;
      updateControl("button", "pause", `Pause "${_this.title}"`);
    });
    // this._options.media.addEventListener("playing", (e) => {});
    this._options.media.addEventListener("progress", (e) => {
      // update what percentage (of time) has been downloaded thus far
      if (!!_this.buffered.length && _this._options.loaded !== true) {
        // save the values here to keep get calls to a minimum
        const buffered = _this.buffered;
        const duration = _this.duration;
        let loaded = 0;
        // use a for-loop in case there are multiple disjoint buffered sections
        for (let r = 0; r < buffered.length; r++)
          loaded += buffered.end(r) - buffered.start(r); // add up the durations that are buffered
        _this._options.loaded = loaded / duration; // get the percent loaded

        // is this completely loaded?
        if (_this._options.loaded >= 1) {
          // dispatch a "loaded" event
          this._options.media.dispatchEvent(
            new Event("loaded", {
              bubbles: true,
              detail: {
                currentTime: _this.currentTime,
                duration,
              },
            })
          );
        }
      }
    });
    // this._options.media.addEventListener("ratechange", (e) => log("ratechange"));
    // this._options.media.addEventListener("resize", (e) => log("resize"));
    this._options.media.addEventListener("seeked", (e) => {
      _this.#updateTime(); // one-off to update the time
    });
    // this._options.media.addEventListener("seeking", (e) => log("seeking"));
    // this._options.media.addEventListener("suspend", (e) => log("suspend"));
    this._options.media.addEventListener("timeupdate", (e) => {
      _this.#updateTime();
    });
    // this._options.media.addEventListener("volumechange", (e) => log("volumechange"));

    // setup any event listeners already User submitted
    if (!!this._options.listeners) {
      Object.entries(this._options.listeners).forEach(
        ([event, { listener, options }]) =>
          this.addEventListener(event, listener, options)
      );
    }
  }

  /**
   * Gets the ID
   * @returns {string}
   * @readonly
   * @override
   */
  get id() {
    if (!this._data?.id) {
      // from https://gist.github.com/hyamamoto/fd435505d29ebfa3d9716fd2be8d42f0?permalink_comment_id=4261728#gistcomment-4261728
      const hash = (text) =>
        text
          .split("")
          .reduce((s, c) => (Math.imul(31, s) + c.charCodeAt(0)) | 0, 0);

      // use the domain plus hash() of the sourceURL
      this._data.id =
        this.domain + "-" + (hash(this.sourceURL) + "").replace(/^-/, "");
    }

    return this._data.id;
  }
  /** Gets the source URL
   * @returns {string}
   * @example "https://amplfr.com/"
   */
  get sourceURL() {
    if (!this._data?.sourceURL)
      this._data.sourceURL = this._data?.url?.toString();

    return this._data?.sourceURL;
  }
  get src() {
    return this._data?.src
  }
  /**
   * Gets the domain from the source URL
   * @returns {string}
   * @example "amplfr"
   */
  get domain() {
    if (!this._data.domain)
      try {
        this._data.domain = this._data?.url?.hostname;
      } catch (error) { }

    return this._data.domain;
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
    return this._data?.artists || null;
  }

  // media controls
  /**
   * Plays the media.
   * @see {@link appendMedia} for loading the media
   */
  play() {
    // pause if not already
    if (!this.paused && this._options.media) {
      this._options.media.pause();
      return;
    }
    if (!!this.ended) this.fastSeek(0); // restart from the beginning if ended

    // play (so long as there are no errors)
    if (!this._options.media.error) this._options.media.play();
  }
  /**
   * Pauses the media.
   * @see {@link appendMedia} for loading the media
   */
  // prettier-ignore
  pause() { this._options.media?.pause() }
  /**
   * Stops the media.
   * Equivilent to {@link AmplfrItem#pause|pause()} and {@link AmplfrItem#seekTo|seekTo(0)}
   * @see {@link AmplfrItem#appendMedia} for loading the media
   */
  stop() {
    this._options.media?.pause();
    this.fastSeek(this.startTime); // reset the time back to beginning
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
    if (!this._options.media) return;

    let startTime = this._data.start || 0;
    let endTime = this._data.end || this.duration || 0;
    s = Math.max(startTime, Math.min(s, endTime)); // keep s within known range

    if (!precise && this._options.media.fastSeek)
      this._options.media.fastSeek(s); // faster (??)
    else this._options.media.currentTime = s; // more precise
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
    if (!this._options.media) return;

    this._options.media.loop = !!v;
    if (typeof v == "number") {
      this._options.loopCounter = Math.min(1, v); // save the number of times to loop (>=0)
      this._options.media?.addEventListener("ended", this.#decrementLoops);
      if (v <= 0) this.#decrementLoops();
    }
  }
  #decrementLoops = (e) => {
    --this._options.loopCounter; // one less time to loop

    // no more looping
    if (this._options.loopCounter <= 0) {
      this._options.loopCounter = 0;
      this._options.media.loop = false;
      this._options.media.removeEventListener("ended", this.#decrementLoops);
    }
  };
  // prettier-ignore
  set muted(v = !this.muted) { if (!!this._options.media) this._options.media.muted = (!!v) }
  // prettier-ignore
  set playbackRate(v = 1) { if (!!this._options.media) this._options.media.playbackRate = v }
  // prettier-ignore
  set volume(v = 1) { if (!!this._options.media) this._options.media.volume = v }

  // media property get'ers - each returns null if this._options.media is null
  get startTime() {
    // try to extract start and end times if url is actually a URL
    let startTime = this._data.startTime;
    let searchParams = {};
    if (!startTime) {
      try {
        searchParams = this.sourceURL.searchParams;
      } catch (error) { }

      startTime = searchParams["s"] || !!searchParams["start"] || 0;
      this._data.startTime = startTime;
    }
    return startTime;
  }
  get endTime() {
    // try to extract start and end times if url is actually a URL
    let endTime = this._data.endTime;
    let searchParams = {};
    if (!endTime) {
      try {
        searchParams = this.sourceURL.searchParams;
      } catch (error) { }

      endTime = searchParams["e"] || !!searchParams["end"] || this.duration;
      this._data.endTime = endTime;
    }
    return endTime;
  }
  // prettier-ignore
  get bytes() { return this._options?.mediaBytes || 0; }
  // prettier-ignore
  get loaded() { return this._options?.loaded || 0.0 }
  // prettier-ignore
  get buffered() { return this._options.media?.buffered || 0 }
  // prettier-ignore
  get currentTime() { return this._options.media?.currentTime }
  // prettier-ignore
  get duration() { return this._options.media?.duration }
  // prettier-ignore
  get durationMMSS() { return (!!this.duration) ? Number(this.duration).toMMSS() : null }
  // prettier-ignore
  get ended() { return this._options.media?.ended }
  // prettier-ignore
  get loop() { return this._options.media?.loop }
  // prettier-ignore
  get muted() { return this._options.media?.muted }
  // prettier-ignore
  get networkState() { return this._options.media?.networkState }
  // prettier-ignore
  get paused() { return this._options.media?.paused }
  // prettier-ignore
  get playbackRate() { return this._options.media?.playbackRate }
  // prettier-ignore
  get readyState() { return this._options.media?.readyState }
  // prettier-ignore
  get seekable() { return this._options.media?.seekable }
  // prettier-ignore
  get volume() { return this._options.media?.volume }
  // prettier-ignore
  get artwork() { return this._options?.artwork }

  addEventListener(type, listener, options) {
    const mediaListeners = [
      "abort",
      "canplay",
      "canplaythrough",
      "durationchange",
      "emptied",
      "ended",
      "error",
      "loaded",   // added
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

    if (mediaListeners.includes(type)) {
      // if media isn't setup yet, save this event listener for once it is
      if (!this._options.media) {
        this._options.listeners = this._options.listeners || {};
        this._options.listeners[type] = { listener, options };
        return;
      }

      this._options.media.addEventListener(type, listener, options);
      // else this.addEventListener(type, listener, options)
    }
  }

  /**
   * connectedCallback() is called when this element is (re-)added to the DOM
   */
  async connectedCallback() {
    this.render()
  }

  async render() {
    if (!!this._options.isBuilt) return; // no need to build again if already done
    this._options.isBuilt = 'building'

    // start the build
    if (this._options?.useShadow)
      this._options.root = document.createElement("div");
    else this._options.root = this;

    // if (!this._data?.src) await this._populate();
    if (!this._data || !!this._data.then) await this._populate();

    this._options.isBuilt = true; // get here, and there's no need to run again
    this._options.root.setAttribute("is", this._options.class);

    this._options.root.classList.add("item");
    // TODO need to append appropriate additional controls
    //  - probably in appendAdditionalControls()
    //  - play/pause already taken care of
    //  - share - should always be visible
    //  - rate (like/dislike)

    // TODO ensure that Title, Artist(s), Album are links (when available)

    // append primary elements (order matters)
    this.appendArtwork();
    this.appendTitle();
    this.appendTimeline(); // after Title but before Artist(s), Collection, etc.
    this.appendAdditional( // append additional (secondary) elements
      this._options.root,
      this.appendArtists,
      this.appendAlbum,
      this.appendTime,
      this.appendControlsAdditional,
      this.appendLogo
    );

    // if this._options.mediaType isn't deferred (NULL), call appendMedia(this._options.mediaType) now
    if (!!this._options.mediaType) this.appendMedia(this._options.mediaType);

    // finishing touches
    this._options.root.setAttribute("title", this._data.title);
    // this._makeDraggable(); // make it dragable

    // finish up the build
    if (!this._options?.useShadow || !!this.shadowRoot) return;
    const shadow = this.attachShadow({ mode: "open" }); // Create a shadow root

    // Apply external styles to the shadow dom
    const linkElem = document.createElement("link");
    linkElem.setAttribute("rel", "stylesheet");
    linkElem.setAttribute("href", `/css/item.css`);

    // Attach the created elements to the shadow dom
    shadow.appendChild(linkElem);
    shadow.appendChild(this._options.root);
  }

  disconnectedCallback() { }

  adoptedCallback() { }

  attributeChangedCallback(name, oldValue, newValue) { }

  appendAdditional(root, ...Fns) {
    // make the containing UL
    const additional = document.createElement("ul");
    const _this = this;

    // run each function f
    Fns.forEach((fn) => {
      let li = document.createElement("li"); // containing LI

      // call fn(li) with _this bound
      fn.bind(_this)(li);

      // don't append if there was no output
      if (li.innerHTML != "") additional.appendChild(li);
    });
    root.appendChild(additional);
  }

  appendArtwork(root = this._options.root) {
    // skip the rest if artwork isn't wanted, or this has already been run
    if (this._options?.artwork == false) return;

    let artwork =
      this._data?.artwork ||
      "/albumart/" + (this._data.album?.id || this._data.albumid || `item/${this._data.id}`) + ".jpg";

    let artworkE = new Image();
    artworkE.classList.add("artwork");

    if (!artwork || artwork.indexOf("undefined") > -1) {
      artworkE.style.backgroundColor = "grey";
      // use a blank 1x1 PNG
      artworkE.src =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=";
    } else {
      artworkE.src = artwork;
      artworkE.alt = this.title || this._data.title;
      this.#decorateWithImageColor(artworkE);
    }

    return root.appendChild(artworkE);
  }
  appendArtists(root = this._options.root) {
    const artists = this._data.artists;
    if (!root || !artists || !Array.isArray(artists) || artists?.length < 1)
      return;

    // create a child element for each Artist, populate it, and append it to e
    const attributes = ["name", "area", "started", "ended", "id"];
    artists.forEach((artist, i) => {
      let artistE;
      if (!!artist.href || !!artist.url || !!artist.src) {
        artistE = document.createElement("a");
        artistE.setAttribute("href", artist.href || artist.url || artist.src);
        delete artist?.href;
        delete artist?.url;
        delete artist?.src;
      } else artistE = document.createElement("span");
      artistE.classList.add("artist");

      if (typeof artist != "string")
        assignDataset(artistE.dataset, artist, attributes); // assign child's dataset from this artist's attributes

      if (!!artist.id) artistE.dataset.id = `artist-${artist.id}`;
      artistE.textContent = artist.name || artist;
      artistE.title = artist.name || artist;

      root.appendChild(artistE);
    });

    // add class 'metadata' if root is a LI
    if (root.tagName == "LI") root.classList.add("metadata");
  }
  appendAlbum(root = this._options.root) {
    const album = this._data.album;
    if (!root || !album) return;

    let albumE;
    if (!!album.href || !!album.url || !!album.src) {
      albumE = document.createElement("a");
      albumE.setAttribute("href", album.href || album.url || album.src);
      delete album?.href;
      delete album?.url;
      delete album?.src;
    } else albumE = document.createElement("span");
    albumE.classList.add("album");

    albumE.textContent = album.title || album;
    albumE.title = album.title || album;

    // create a child element for each Artist, populate it, and append it to e
    const attributes = ["id", "year"];
    if (typeof album != "string") {
      assignDataset(albumE.dataset, album, attributes); // assign albumE's dataset from this album's attributes

      let dateObj;
      let dateText;
      if (!!album.id) albumE.dataset.id = `album-${album.id}`;
      if (!!album.date) {
        dateObj = new Date(Date.parse(album.date)); // convert to a Date()
        dateText = dateObj.toISOString(); // save date as an ISOString
        // prettier-ignore
        dateText = dateText.substring(0, dateText.indexOf("T", 8));
        albumE.dataset.date = dateText || album.date;
      }
      if (!!albumE?.dataset.year) {
        albumE.title += ` (${albumE.dataset.year || dateObj?.getFullUTCYear()
          })`;
      }
    }

    root.appendChild(albumE);

    // add class 'metadata' if root is a LI
    if (root.tagName == "LI") root.classList.add("metadata");
  }
  appendChildTags(
    root = this._options.root,
    data = this._data,
    childTags = this._options.childTags
  ) {
    if (!root || !childTags || !data || Object.keys(data).length < 1) return;

    // list of additional child tags to populate
    childTags.forEach((tag) => {
      if (!!data[tag]) {
        const e = document.createElement("div");
        const text = data[tag];

        // Take attribute content and save it to root's dataset, and inside the childElement div
        root.dataset[tag] = text;
        e.textContent = text;
        e.classList.add(tag);

        // return root.appendChild(e);
        root.appendChild(e);
      }
    });
  }
  appendTitle(root = this._options.root) {
    const title = this._data.title;
    if (!root || !title) return;
    const data = this._data;

    let titleE;
    // look at data (object) instead of title (string) for link
    if (!!data.href || !!data.url) {
      titleE = document.createElement("a");
      titleE.setAttribute("href", data.href || data.url);
    } else titleE = document.createElement("span");
    titleE.classList.add("title");

    titleE.textContent = title;
    titleE.title = title;

    root.appendChild(titleE);
  }
  appendControls(root = this._options.root) {
    // skip the rest if controls aren't wanted, or this has already been run
    if (
      this._options?.controls == false
      // ||
      //   !this._options.standalone ||
      //   !!this._options?.controls?.button
    )
      return;

    // add the control button
    const e = document.createElement("button");
    e.classList.add("material-icons");

    // if (
    //   this._options?.controls == false ||
    //   !this._options.standalone ||
    //   !!this._options?.controls?.button
    // )
    //   e.classList.add("hidden")

    root.appendChild(e);

    const _this = this;
    e.addEventListener("click", function (e) {
      e.preventDefault();
      _this.play();
    });
    e.addEventListener("touchend", function (e) {
      e.preventDefault();
      _this.play();
    });

    // TODO add additional (hidable) buttons here

    // save the controls for easy access later
    this._options.controls = {
      button: e,
    };
  }
  appendControlsAdditional(root = this._options.root) {
    const _this = this;
    const additionalControls = [
      {
        conditional: navigator.canShare,
        text: "share",
        fn: async () => {
          let url = new URL(_this.sourceURL, 'https://amplfr.com/')
          url = url.toString()
          if (navigator.canShare) navigator.share({
            title: `Amplfr.com - ${_this.title}`,
            text: `Play "${_this.title}"`,
            url,
          })
        },
        title: "Share this",
      },
    ];
    // add class 'icons' if root is a LI
    if (root.tagName == "LI") root.classList.add("icons");

    additionalControls.forEach((ctrl) => {
      // skip this control if already added
      if (!!_this._options.controls[ctrl.text]) return;
      if (!ctrl?.conditional) return; // bail if the check doesn't pass

      // add the control button
      const e = document.createElement("span");
      e.classList.add("material-icons", "icon");
      e.textContent = ctrl.text;
      e.setAttribute("title", ctrl.title);
      root.appendChild(e);

      e.addEventListener("click", function (e) {
        e.preventDefault();
        ctrl.fn(e);
      });
      e.addEventListener("touchend", function (e) {
        e.preventDefault();
        ctrl.fn(e);
      });

      // save this control for easy access later
      _this._options.controls[ctrl.text] = e;
    });
  }
  appendLogo(root = this._options.root) {
    const logoE = document.createElement("a");

    // SVG and Path elements need to use createElementNS() to include Namespace
    // see https://stackoverflow.com/a/10546700
    const NS = "http://www.w3.org/2000/svg";
    const logoSVG = document.createElementNS(NS, "svg");
    const logoPath = document.createElementNS(NS, "path");

    logoPath.setAttribute(
      "d",
      "M 47.00,62.00 C 47.00,62.00 64.95,15.00 64.95,15.00 70.25,0.84 69.60,0.06 78.00,0.00 78.00,0.00 91.00,0.00 91.00,0.00 92.69,0.03 94.87,-0.07 96.30,0.99 97.85,2.14 99.36,6.16 100.15,8.00 100.15,8.00 107.85,27.00 107.85,27.00 107.85,27.00 132.42,87.00 132.42,87.00 135.50,94.33 144.84,115.57 146.00,122.00 146.00,122.00 125.00,109.60 125.00,109.60 125.00,109.60 113.84,101.68 113.84,101.68 113.84,101.68 104.81,79.00 104.81,79.00 104.81,79.00 91.69,44.00 91.69,44.00 91.69,44.00 83.00,19.00 83.00,19.00 83.00,19.00 76.98,42.00 76.98,42.00 76.98,42.00 66.00,73.00 66.00,73.00 66.00,73.00 47.00,62.00 47.00,62.00 Z M 41.00,69.00 C 41.00,69.00 69.00,85.40 69.00,85.40 69.00,85.40 111.00,110.81 111.00,110.81 111.00,110.81 138.00,127.00 138.00,127.00 138.00,127.00 138.00,129.00 138.00,129.00 138.00,129.00 72.00,169.20 72.00,169.20 72.00,169.20 41.00,187.00 41.00,187.00 41.00,187.00 41.00,69.00 41.00,69.00 Z M 31.00,103.00 C 32.82,107.60 32.00,121.34 32.00,127.00 32.00,127.00 32.00,159.00 32.00,159.00 31.98,171.17 27.55,175.11 25.00,186.00 25.00,186.00 0.00,186.00 0.00,186.00 0.00,186.00 10.80,156.00 10.80,156.00 10.80,156.00 31.00,103.00 31.00,103.00 Z M 130.00,144.00 C 130.00,144.00 151.00,132.00 151.00,132.00 151.00,132.00 173.00,186.00 173.00,186.00 173.00,186.00 153.00,186.00 153.00,186.00 153.00,186.00 145.81,184.40 145.81,184.40 145.81,184.40 140.32,172.00 140.32,172.00 140.32,172.00 130.00,144.00 130.00,144.00 Z"
    );
    logoSVG.appendChild(logoPath);

    logoSVG.classList.add("logo");
    logoSVG.setAttribute("viewBox", "0 0 173 187");
    logoE.appendChild(logoSVG);

    logoE.setAttribute("href", "//amplfr.com");
    logoE.setAttribute("title", "Amplfr.com");
    root.appendChild(logoE);

    // add class 'icons' if root is a LI
    if (root.tagName == "LI") root.classList.add("logo");
  }
  appendTime(root = this._options.root) {
    // add the time element (to root)
    const timeE = document.createElement("div");
    timeE.classList.add("time");
    // this._options.root.appendChild(timeE);
    root.appendChild(timeE);

    this._options.time = timeE; // save timeE for easy access later

    const _this = this;
    timeE.addEventListener("click", (e) => {
      e.preventDefault()
      e.currentTarget.classList.toggle("remaining");
      _this.#updateTime();
    });
    timeE.addEventListener("touchend", (e) => {
      e.preventDefault()
      e.currentTarget.classList.toggle("remaining");
      _this.#updateTime();
    });

    // add class 'icons' if root is a LI
    if (root.tagName == "LI") root.classList.add("time");
  }
  appendTimeline() {
    // add the timeline container element (to root)
    const timelineContainerE = document.createElement("div");
    timelineContainerE.classList.add("timeline-container");
    this._options.root.appendChild(timelineContainerE);
    this._options.progress = timelineContainerE; // save timelineContainerE for easy access later

    // add the timeline element (to timeline container element)
    const timelineE = document.createElement("div");
    timelineE.classList.add("timeline");
    timelineContainerE.appendChild(timelineE);

    // add the thumb-indicator element (to timeline element)
    const thumb = document.createElement("div");
    thumb.classList.add("thumb-indicator");
    timelineE.appendChild(thumb);

    // Timeline - use PointerEvents instead of MouseEvents
    timelineContainerE.addEventListener("pointermove", handleTimelineUpdate)
    timelineContainerE.addEventListener("pointerdown", toggleScrubbing)
    document.addEventListener("pointerup", e => {
      if (isScrubbing) toggleScrubbing(e)
    })
    document.addEventListener("pointermove", e => {
      if (isScrubbing) handleTimelineUpdate(e)
    })

    let isScrubbing = false
    let wasPaused
    const _this = this
    function toggleScrubbing(e) {
      const rect = timelineContainerE.getBoundingClientRect()
      const percent = Math.min(Math.max(0, e.x - rect.x), rect.width) / rect.width
      isScrubbing = (e.buttons & 1) === 1
      if (isScrubbing) {
        wasPaused = _this.paused
        _this.pause()
      } else {
        _this.currentTime = percent * _this.duration
        if (!wasPaused) _this.play()
      }

      handleTimelineUpdate(e)
    }

    function handleTimelineUpdate(e) {
      const rect = timelineContainerE.getBoundingClientRect()
      const percent = Math.min(Math.max(0, e.x - rect.x), rect.width) / rect.width

      if (isScrubbing) {
        e.preventDefault()
        timelineContainerE.style.setProperty("--progress-position", percent)
        _this.#updateTime(percent * _this.duration)
      }
    }
  }
  #updateTime(seconds = this.currentTime) {
    if (!this || !this._options.media) return; // no media, nothing else to do here

    const duration = this.duration || 0 // this._options.media.duration;
    const percent = seconds / duration;

    // set the current time
    if (!!this._options.time) {
      if (this._options.time.classList.contains("remaining")) {
        this._options.time.innerText = `-${(duration - seconds).toMMSS()}`;
        this._options.time.title = "Time remaining";
      } else {
        this._options.time.innerText = seconds.toMMSS();
        this._options.time.title = "Time elapsed";
      }
    }

    // set the timeline position
    if (!!this._options.progress)
      this._options.progress.style.setProperty("--progress-position", percent);
  }

  async #decorateWithImageColor(img, palettes) {
    // if ColorThief exists
    if (!ColorThief) return;

    // TODO run ColorThief async
    if (!palettes) {
      const colorThief = new ColorThief();
      if (img.complete) {
        palettes = await colorThief.getPalette(img, 5);
        return this.#decorateWithImageColor(img, palettes);
      } else {
        const _this = this;
        img.addEventListener("load", async function () {
          palettes = await colorThief.getPalette(img, 5);
          return _this.#decorateWithImageColor(img, palettes);
        });
        return;
      }
    }

    // from https://alienryderflex.com/hsp.html
    const hsp = (rgb) => {
      const [r, g, b] = rgb;

      return Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
    };
    // from https://lokeshdhakar.com/projects/color-thief/#faq
    const rgbToHex = (r, g, b) =>
      "#" +
      [r, g, b]
        .map((x) => {
          const hex = x.toString(16);
          return hex.length === 1 ? "0" + hex : hex;
        })
        .join("");

    let color, colorAccent;
    palettes.map((palette) => {
      if (!!color && !!colorAccent) return; // done
      let lightness = hsp(palette) / 255;

      if (lightness > 0.1 && !color) color = palette; // not too dark
      else if (lightness < 0.75 && !colorAccent) colorAccent = palette; // not too bright
    }, this);

    this.style.setProperty("--color", rgbToHex(...color));
    this.style.setProperty("--colorAccent", rgbToHex(...colorAccent));
  }
}
customElements.define("amplfr-item", AmplfrItem, { extends: "div" });
