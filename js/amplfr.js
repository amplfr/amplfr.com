const validAmplfrID =
  /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{22}$/;
const validAmplfrCollectionID =
  /[0-9A-Za-z]{1,25}\/[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{22}/;
Number.prototype.toMMSS = function () {
  if (Number.isNaN(this.valueOf())) return "";
  let neg = this < 0 ? "-" : "";
  let t = Math.abs(this);
  let s = Math.round(t % 60),
    m = Math.floor(t / 60);

  if (m >= 60) m = `${m / 60}:${(m % 60).toString().padStart(2, "0")}`;
  return `${neg}${m}:${s.toString().padStart(2, "0")}`;
};
Number.prototype.toHumanBytes = function () {
  // function formatBytes(bytes, decimals) {
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
    title: url.split("/").pop().split(".")[0].replace(/[-_]/g, " "),
    // src: src.toString(),
    src: [
      {
        mime,
        bytes,
        url: src.toString(),
      },
    ],
  };

  const jsmediatags = window.jsmediatags;
  if (!!jsmediatags) {
    const jsmediatagsPromise = async (src) =>
      await new Promise((resolve, reject) => {
        new jsmediatags.Reader(src)
          .setTagsToRead(["album", "artist", "picture", "title", "year"])
          .read({
            onSuccess: (tag) => resolve(tag),
            onError: (err) => reject(err),
          });
      });

    try {
      let { tags } = await jsmediatagsPromise(src);

      if (!!tags.title) obj.title = tags.title;
      if (!!tags.artist) obj.artist = tags.artist;
      if (!!tags.album) obj.album = tags.album;
      if (!!tags.year) obj.year = tags.year;
      if (!!tags.picture) {
        const { data, format } = tags.picture;
        let base64String = "";
        for (let i = 0; i < data.length; i++)
          base64String += String.fromCharCode(data[i]);
        obj.artwork = `data:${format};base64,${window.btoa(base64String)}`;
      }
    } catch (err) {
      console.warn(err);
    }
  }

  return obj;
};
/**
 * Fetches the given URL, parses the received media file, and returns an object with the extracted metadata.
 * The return object can be used as input for _populate().
 * @param {string} [url] The URL endpoint/file to fetch and parse. Only works if the result is a media file with metadata.
 * @private
 * @returns {ItemSourceData}
 */
const parseAmplfr = async (url) => {
  let response;
  let obj;

  response = await fetch(url);
  if (response.ok && !!response.body) obj = await response.json();
  const id = obj.id;
  obj = {
    id,
    title: obj.title,
    album: obj.album,
    artists: obj.artists,
    artwork: "/albumart/" + (obj?.album?.id || `item/${id}`) + ".jpg",
    url: obj.url || url, // ensure URL is included
  };

  /**
   * Adds a nicely formatted obj.href based on obj.url, but without the "/api" or ".json"
   * @param {Object} obj
   * @returns obj (with the HREF set)
   */
  const appendHREF = (obj) => {
    if (Array.isArray(obj)) return obj.forEach((e) => appendHREF(e));

    // insert in HREF based on the URL, without "/api" and ".json"
    let href = obj?.url || "";
    if (!href || href == "") return;

    // remove "/api" and ".json"
    href = href.replace(/\/api|\.json$/g, "");

    const encodedTitle = encodeURI(obj.title || obj.name).replace("%20", "+");
    if (!href.endsWith(encodedTitle)) href += `/${encodedTitle}`;

    obj.href = href;
  };

  appendHREF(obj);
  appendHREF(obj.album);
  appendHREF(obj.artists);

  // get the list of media files
  let files = obj.src || obj.files;
  if (!files) {
    // if files isn't provided, fetch() it
    response = await fetch(`/api/${id}.files`);
    if (response.ok && !!response.body) files = await response.json();
  }
  if (!!files) {
    const media = document.createElement("video");
    obj.src = files
      // return the list media that client might be able to play
      .filter((f) => media.canPlayType(f.mime || f) !== "") // skip anything client can't play
      .map((f) => {
        f.src = url.substring(0, url.indexOf(".", -8)).replace(id, f.filename); // use f.filename to set the correct src
        return f;
      })
      .sort((a, b) => {
        // prefer media files that are playable by client
        const map = {
          probably: 1, // best chance
          maybe: 2, // could be a chance
          "": 3, // no chance
        };

        if (map[a] < map[b]) return -1; // a < b
        else if (map[a] > map[b]) return 1; // a > b
        else return 0; // a = b
      });
  }

  return obj;
};

/**
 * AmplfrItem is an HTML element created from a URL, comprised of the related Title, Artist(s), and other metadata.
 * @name AmplfrItem
 * @extends HTMLDivElement
 */
class AmplfrItem extends HTMLDivElement {
  _data; // holds internal data object
  _options; // holds options and internal parameters

  /**
   * @param {ItemSourceData|string|null} data ItemSourceData object or URL to populate the element. Using a null value will use the element's dataset or src attributes.
   * @param {string|boolean|null} [mediaType] "Audio" or "video" to indicate the type to be used for the child HTMLMediaElement created as part of creating this when added to the DOM.
   * If non-null value is given, then the child HTMLMediaElement will be created once added to the DOM - e.g., document.body.appendChild(AmplfrItem).
   * If null (default) value is used, then the child HTMLMediaElement will not be created until appendMedia() is called.
   */
  // constructor(data, mediaType = null) {
  constructor(data, options = {}) {
    super(); // Always call super first in constructor

    this._data = {};
    this._options = {};
    this._options.useShadow = false; // toggle if resulting elements should go in shadow DOM instead

    this._options.controls = options?.controls || {}; // use an object instead of boolean for easy access to controls later
    this._options.standalone = options?.standalone || true; // set to false if this is part of an AmplfrCollection
    this._options.mediaType = options?.media || options;
    this._options.childTags = ["title", "collection"];

    // only if this object is an AmplfrItem vs some extended class
    if (this instanceof AmplfrItem)
      if (typeof data == "string") {
        // // check if domain is just an AmplfrID
        // if (data.length == 22 && data.match(validAmplfrID)) {
        //   // use a URL that points to the API endpoint for the AmplfrID
        //   this.src = document.location.origin + `/api/${data}.json`;
        //   this._data = parseAmplfr(this.src); // parse url as a Amplfr URL, saving the promise
        // }
        // // if data is a string, hopefully it's a URL (under 2083 characters) with additional data
        // else if (data.length <= 2083) {
        // this.src = data; // save the URL
        // this._data = this.parse(this.src); // fetch the URL, saving the promise
        // this._data = AmplfrItem.parse(this.src); // fetch the URL, saving the promise
        this._data = AmplfrItem.parse(data); // fetch the URL, saving the promise
        // }
      } else this._populate(data);
  }

  /**
   * Fetches the given URL, parses the received media file, and returns an object with the extracted metadata.
   * The return object can be used as input for _populate().
   * @param {string} [url] The URL endpoint/file to fetch and parse.
   * @returns {ItemSourceData}
   */
  // async _parse(url) {
  static async parse(url) {
    if (!url && !!this.src) url = this.src; // use src

    let domain;
    let urlObj;
    // try to slice up the URL and save the domain part
    try {
      urlObj = new URL(url);
      domain = urlObj.hostname.replace(/www\.|m\./, "");
    } catch (err) {
      domain = url; // in case url wasn't a real URL
    }

    let obj;
    switch (domain) {
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
    const keys = ["id", "url", "title", "artwork", "albumid", "start", "end"];
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
    if (!!source.href) this._data.href = source.href; // if href exists, save it
    if (!!source.src) this._data.src = source.src; // if src exists, save it

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

    if (!this._data.src || !Array.isArray(this._data.src)) {
      this._options.media.src = this._data.url;
      if (!!type) this._options.media.type = type;
    } else {
      this._data.src.forEach((f) => {
        // append a source element for each URL/MIME-type
        const source = document.createElement("source");
        source.src = f.url || f.src;
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
      } catch (err) {}
      if (!res.ok)
        warn(
          `Cannot load "${URL}" (HTTP${res.status}: ${res.statusText}).\n` +
            `Please double check the URL and try again.`
        );
    });
    this._options.media.addEventListener("stalled", (e) => warn("stalled"));
    this._options.media.addEventListener("waiting", (e) => warn("waiting"));

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
      updateControl("button", "play_arrow", "Play");
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
        updateControl("button", "replay", "Replay");
    });
    // this._options.media.addEventListener("loadeddata", (e) => {});
    this._options.media.addEventListener("loadedmetadata", (e) => {
      _this.#updateTime();

      // attempt a HEAD request for the media file to get its size
      // this is a best effort attempt, hence the .then()
      fetch(this._options.media.currentSrc, { method: "HEAD" })
        .then((res) => {
          if (res.ok) {
            // use either the Content-Range or Content-Length header values
            this._options.mediaBytes = parseInt(
              res.headers.get("Content-Range")?.split("/")[1] ||
                res.headers.get("Content-Length"),
              10
            );
          }
        })
        .catch((err) => console.warn(err.message || err));
    });
    // this._options.media.addEventListener("loadstart", (e) => {});
    this._options.media.addEventListener("pause", (e) => {
      if (e.currentTarget != _this._options.media) return;
      updateControl("button", "play_arrow", "Play");

      // _this.#updateTime(false); // stop updating time
    });
    this._options.media.addEventListener("play", (e) => {
      if (e.currentTarget != _this._options.media) return;
      updateControl("button", "pause", "Pause");
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
          _this.dispatchEvent(
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
    if (!this._data.sourceURL)
      this._data.sourceURL = this._data?.url.toString();

    return this._data.sourceURL;
  }
  get src() {
    return this._options?.media?.src || !this._options?.media?.currentSrc;
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
      } catch (error) {}

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
    if (!this.paused) {
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
   * Equivilent to {@link pause} and {@link seekTo}(0)
   * @see {@link appendMedia} for loading the media
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
  set muted(v=!this.muted) { if (!!this._options.media) this._options.media.muted = (!!v) }
  // prettier-ignore
  set playbackRate(v=1) { if (!!this._options.media) this._options.media.playbackRate = v }
  // prettier-ignore
  set volume(v=1) { if (!!this._options.media) this._options.media.volume = v }

  // media property get'ers - each returns null if this._options.media is null
  get startTime() {
    // try to extract start and end times if url is actually a URL
    let startTime = this._data.startTime;
    let searchParams = {};
    if (!startTime) {
      try {
        searchParams = this.sourceURL.searchParams;
      } catch (error) {}

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
      } catch (error) {}

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
    if (this._options.isBuilt == true) return; // no need to build again if already done

    // start the build
    if (this._options?.useShadow)
      this._options.root = document.createElement("div");
    else this._options.root = this;

    await this._populate();

    this._options.isBuilt = true; // get here, and there's no need to run again

    this._options.root.classList.add("item");
    // this._options.root.dataset.id = this.domain + "=" + this._data.id; // FIXME maybe

    // TODO add option if this is standalone (default is true)
    //  (option.standalone === true)
    //    this.appendArtwork()
    //    this.appendAdditionalControls() // see below

    // TODO need to append appropriate additional controls
    //  - probably in appendAdditionalControls()
    //  - play/pause already taken care of
    //  - share - should always be visible
    //  - rate (like/dislike)

    // TODO ensure that Title, Artist(s), Album are links (when available)

    // append primary elements (order matters)
    if (!!this._options.standalone) this.appendArtwork(); // handle special case artwork
    // this.appendLogo();
    // this.appendTime();
    this.appendTitle();
    this.appendTimeline(); // after Title but before Artist(s), Collection, etc.

    // append additional (secondary) elements
    this.appendAdditional(
      this._options.root,
      this.appendArtists,
      this.appendAlbum,
      this.appendControlsAdditional,
      this.appendTime,
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

  disconnectedCallback() {}

  adoptedCallback() {}

  attributeChangedCallback(name, oldValue, newValue) {}

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

  appendArtwork() {
    let artwork =
      this._data?.artwork ||
      "/albumart/" + (this._data.albumid || `item/${this._data.id}`) + ".jpg";
    // if (!artwork || artwork.indexOf("undefined") > -1) artwork = null;
    if (!artwork || artwork.indexOf("undefined") > -1) return;

    // let artworkE = document.createElement("div");
    let artworkE = new Image();
    artworkE.classList.add("artwork");
    artworkE.src = artwork;
    artworkE.style.backgroundColor = "grey";

    this.#decorateWithImageColor(artworkE);

    return this._options.root.appendChild(artworkE);
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
        albumE.title += ` (${
          albumE.dataset.year || dateObj?.getFullUTCYear()
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
      this._options?.controls == false ||
      !this._options.standalone ||
      !!this._options?.controls?.button
    )
      return;

    // add the control button
    const e = document.createElement("button");
    e.classList.add("material-icons");
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
        fn: _this.share,
        title: "Share this",
      },
    ];
    // add class 'icons' if root is a LI
    if (root.tagName == "LI") root.classList.add("icons");

    additionalControls.forEach((ctrl) => {
      // skip this control if already added
      if (!!_this._options.controls[ctrl.text]) return;
      if (!!ctrl?.conditional) return; // bail if the check doesn't pass

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
      timeE.classList.toggle("remaining");
      _this.#updateTime();
    });
    timeE.addEventListener("touchend", (e) => {
      timeE.classList.toggle("remaining");
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
  }
  #updateTime(continuously) {
    // if (continuously === false) clearInterval(this._options.updater); // stop updating
    if (!this || !this._options.media) return; // no media, nothing else to do here

    const seconds = this.currentTime || this._options.media.currentTime;
    const duration = this.duration || this._options.media.duration;
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

    // keep updating
    // if (continuously === true) {
    //   const _this = this;
    //   this._options.updater = setInterval(_this.#updateTime.bind(_this), 250);
    // }
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

    const hsp = (rgb) => {
      const [r, g, b] = rgb;

      return Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
    };
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

/**
 * AmplfrCollection is an HTML element comprised of a list of {@link AmplfrItem}s.
 * @name AmplfrCollection
 * @see {@link AmplfrItem}
 * @extends AmplfrItem
 * @inheritdoc
 */
// class AmplfrCollection extends HTMLDivElement {
class AmplfrCollection extends AmplfrItem {
  // #useShadow = false; // toggle if resulting elements should go in shadow DOM instead
  _data; // holds internal data object
  _options;

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

    this._data = {};
    this._options = {};

    this._options.useShadow = false; // toggle if resulting elements should go in shadow DOM instead
    this._options.preloadCount = 2; // navigator.hardwareConcurrency || 2; // max number of items to preload

    // only if this object is an AmplfrCollection vs some extended class
    if (this instanceof AmplfrCollection) {
      if (typeof data == "string") {
        // if data has any whitespace characters (a URL should not)
        //  then split on each whitespace character and save each token as an item
        if (/\s/.test(data)) this._data.items = data.split(/\s/);
        else if (data.match(validAmplfrCollectionID)) {
          // use a URL that points to the API endpoint for the AmplfrID
          this.src = document.location.origin + `/api/${data}.json`;
          this._data = parseAmplfr(this.src); // parse url as a Amplfr URL, saving the promise
        }
        // if data is a string, hopefully it's a URL (under 2083 characters) with additional data
        else if (data.length <= 2083) {
          this.src = data; // save the URL
          this._data = this._parse(this.src); // fetch the URL, saving the promise
        }
      } else if (Array.isArray(data)) {
        // look at each of the entries as its own AmplfrItem
        this._data = data.map((x) => super.parse(x));
        // this._populate(data); // now populate the data
      } else this._populate(data);
    }
  }

  /**
   * Fetches the given URL, parses the received media file, and returns an object with the extracted metadata.
   * The return object can be used as input for _populate().
   * @param {string} [url] The URL endpoint/file to fetch and parse.
   * @returns {CollectionSourceData}
   */
  async _parse(url) {
    if (!url && !!this.src) url = this.src; // use src

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
              return this._parseM3U(urlObj, text);
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
  _parseM3U(urlObj, text) {
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
  async _populate(obj) {
    if (!!this._data) {
      // was this._parse(URL) called in the constructor?
      if (this._data.then) {
        obj = await this._data; // await for the Promise to resolve
        this._data = {}; // reset _data object
      } else if (Array.isArray(this._data) && this._data[0].then) {
        // await for all of the Promises to resolve
        // obj = await Promise.allSettled(this._data).then((results) =>
        //   results.map((x) => x.value)
        // );
        obj = await Promise.allSettled(this._data);
        obj = obj.map((x) => x.value);
        this._data = {}; // reset _data object
      }
    }

    // check if there's enough data already provided
    if (!obj) {
      if (Object.keys(this.dataset).length > 1)
        obj = this.dataset; // use dataset
      else if (!!this.src) obj = this.src; // use src
      else return; // nothing else to do here
    }

    // if obj is a string, hopefully it's a URL (under 2083 characters) with additional data
    if (typeof obj == "string" && obj.length <= 2083) {
      let url = obj;
      obj = await this._parse(url);
    }

    // pull out all of the "string" keys from obj, saving to this.dataset
    const keys = ["id", "url", "title", "artwork", "items", "start", "end"];
    keys.forEach((k) => {
      if (!!obj[k] && typeof obj[k] == "string") this._data[k] = obj[k];
    });

    // add the obj.artists (or obj.artist) to a flattened array
    let artists = [];
    if (!!obj.artists) artists.push(...obj.artists);
    if (!!obj.artist) artists.push(obj.artist);
    if (artists.length > 0) this._data.artists = artists.flat();

    if (Array.isArray(obj)) this._data.items = obj; // if obj is an array, save it as list of items

    this.title = this._data?.title;

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
    const items = this._data.items;
    if (!items || items.length < 1) return;

    const e = document.createElement("ol");
    e.classList.add("items");

    // create a child element for each item, populate it, and append it to e
    // items.forEach((item, i) => {
    this._options.items = items.map((item, i) => {
      const li = document.createElement("li");
      let itemE;

      // if item is already an AmplfrItem
      if (item instanceof AmplfrItem) itemE = item; // just save item as itemE
      else itemE = new AmplfrItem(item); // upgrade item to be an AmplfrItem

      // preload a select number of items
      if (i < this._options.preloadCount) itemE.appendMedia();

      li.appendChild(itemE); // append itemE to the LI
      e.appendChild(li); // append LI to the OL

      return itemE; // save the itemE
    });

    this._options.root.appendChild(e);
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
  get domain() { return this._data.domain || null; }
  // prettier-ignore
  get artist() { return this.artists }
  // prettier-ignore
  get artists() { return this._data?.artists || null }
  // prettier -ignore
  // get items() { return this._options.items || null }
  get items() {
    if (!this._options.items)
      this._options.items = this._options.root.querySelectorAll(".item"); // save all of the items

    return this._options.items;
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
    if (i == this._options.itemNumber) return; // nothing to do if already set to this._options.itemNumber

    const playing = this.paused === false ? true : false; // ==false means its playing, but null means nothing
    if (playing === true) this.pause();

    const itemCount = this.items.length;
    // if (i <= 0) i = this._options.items.length + i; // zero or negative values count back from the last item
    // i = Math.max(1, Math.min(i, this._options.items.length)); // keep i in range
    if (i <= 0) i = itemCount + i; // zero or negative values count back from the last item
    i = Math.max(1, Math.min(i, itemCount)); // keep i in range

    this._options.current.classList.remove("current"); // previously current item isn't anymore
    this._options.itemNumber = i;
    this._options.current = this.items[i - 1];

    if (!this._options.current) return; // if #current is bad, just quit

    this._options.current.classList.add("current"); // newly current item is now current
    this._options.current.appendMedia(); // ensure that #current's media is ready

    // start playing the new item if previous item was playing
    if (playing === true) this.play();

    // if #current is the last item and this.loop is false
    if (
      // this._options.itemNumber == this._options.items.length - 1 &&
      this._options.itemNumber == itemCount - 1 &&
      !this.loop
    ) {
        // create and dispatch an 'ended' event
        const ev = new Event('ended')
        this.dispatchEvent(ev)
    }
    // prettier-ignore
    // add 'ended' event to go to the next() item
    else
      this._options.current.addEventListener("ended", this.next(), {
        once: true,
      });
  }
  // prettier-ignore
  set track(i) { this.item(i) }
  // prettier-ignore
  // next() { this.item((this._options.itemNumber || 0) + 1); }
  next() { this.item = (this._options.itemNumber || 0) + 1; }
  // prettier-ignore
  previous() { this.item(this._options.itemNumber - 1 || 0); }
  // prettier-ignore
  set loop(v=!this._options.loop) { this._options.loop = !!v; }
  // prettier-ignore
  set muted(v=!this.muted) { if (!!this._options.current) this._options.current.muted = !!v; }
  // prettier-ignore
  set volume(v=1) { if (!!this._options.current) this._options.current.volume = v; }

  // prettier-ignore
  get duration() { return this._options.current?.duration || null }
  // prettier-ignore
  get ended() { return this._options.current?.ended || null }
  // prettier-ignore
  get loop() { return this._options.current?.loop || null }
  // prettier-ignore
  get muted() { return this._options.current?.muted || null }
  // prettier-ignore
  get volume() { return this._options.current?.volume || null }

  // media controls - mapped to this._options.current item
  play(i = this._options.itemNumber) {
    if (i !== this._options.itemNumber) this.item = i;
    this._options.current?.play();
  }
  // prettier-ignore
  pause() { this._options.current?.pause() }
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
  set playbackRate(v=1) { if (!!this._options.current) this._options.current.playbackRate = v; }

  // media property get'ers - each returns null if this._options.media is null
  // prettier-ignore
  get currentTime() { return this._options.current?.currentTime || null }
  // prettier-ignore
  get networkState() { return this._options.current?.networkState || null }
  // prettier-ignore
  get paused() { return this._options.current?.paused || null }
  // prettier-ignore
  get playbackRate() { return this._options.current?.playbackRate || null }
  // prettier-ignore
  get readyState() { return this._options.current?.readyState || null }
  // prettier-ignore
  get seekable() { return this._options.current?.seekable || null }

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
    if (this._options.isBuilt == true) return; // no need to build again if already done

    await this._populate();

    // start the build
    if (!!this._options.useShadow)
      this._options.root = document.createElement("div");
    else this._options.root = this;

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

    this.appendArtwork(); // handle special case artwork
    // this.appendChildTags(this._options.root, this._data, [
    //   "title",
    //   "collection",
    // ]);
    this.appendTitle();
    this.appendItems(); // handle special case items

    this._options.isBuilt = true; // get here, and there's no need to run again

    // finishing touches
    if (!!this._data.title)
      this._options.root.setAttribute("title", this._data.title);
    // this._makeDraggable(); // make it dragable

    // finish up the build
    if (!this._options.useShadow || !this.shadowRoot) return;
    const shadow = this.attachShadow({ mode: "open" }); // Create a shadow root

    // Apply external styles to the shadow dom
    const linkElem = document.createElement("link");
    linkElem.setAttribute("rel", "stylesheet");
    linkElem.setAttribute("href", `/css/collection.css`);

    // Attach the created elements to the shadow dom
    shadow.appendChild(linkElem);
    shadow.appendChild(this._options.root);

    // once the items and the OL have been appended
    this._options.items = this._options.root.querySelectorAll(".item"); // save all of the items
    this.item = 1; // select the first item
  }
}
// prettier-ignore
customElements.define("amplfr-collection", AmplfrCollection, { extends: "div" });
