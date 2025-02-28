const blankImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=" // a blank 1x1 PNG

/**
 * AmplfrItem
 *  * loads Amplfr element(s)
 *      * fetches data based on provided ID
 *      * loads AmplfrAudio for single Audio element
 *      * loads AmplfrCollection for multiple elements
 *  * renders basic metadata elements
 *      * title
 *      * artist(s) (optionally)
 *      * albums    (optionally)
 *      * artwork   (optionally)
 * 
 * AmplfrAudio
 *  * loads Audio element
 *  * play()
 *  * src
 *  * adds .playing class when playing
 *  * adds .ended class when played (and loop == false)
 * 
 * AmplfrCollection
 *  * loads multiple AmplfrAudio elements and sets up interaction between them
 *  * adds control elements
 *  * adds .active class to element to play
 */


const Elements = [
  "amplfr-item",
  "amplfr-collection",
]
// ].join(",")
const ElementStr = Elements.join(",")
/**
 * AmplfrItem
 * 
 * @TODO MAYBE add timer(seconds=0) that fires _seconds_ from the start or end of the playback
 *  - timer pauses when media is paused
 *  - when _seconds_ is <0, they're offset before the end
 *  - when _seconds_ is >=0, they're offset after the start
 */
class AmplfrItem extends HTMLElement {
  #bytes;
  #data
  #dom = {};
  #media

  constructor(src) {
    super();

    if (!!src)
      if (!!src.id && AmplfrItem.isValidID(src.id)) {
        // src is an object for an AmplfrItem
        this.#data = src
        this.#extract()
      }
      else if (typeof src == "string")
        this.setAttribute("src", src)

    // TODO check for src being a URL direct to a media file (e.g., an MP3 file) and handle appropriately
    // TODO check for src being a YouTube URL and handle appropriately
    // TODO check for src being a Spotify URL and handle appropriately

  }

  static isValidID(text) {
    return typeof text == "string" && /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{22}$/.test(text)
  }

  get title() {
    return this.#data.title || this.#data.name
  }
  get id() {
    return this.#data?.id
  }
  #calculateID(src) {
    // from https://gist.github.com/hyamamoto/fd435505d29ebfa3d9716fd2be8d42f0?permalink_comment_id=4261728#gistcomment-4261728
    // const hash = (text) =>
    //     // (text || '')
    //     (text)
    //         .split("")
    //         .reduce((s, c) => (Math.imul(31, s) + c.charCodeAt(0)) | 0, 0);

    let url = src
    try {
      url = new URL(src, document.location.origin)

      // src = `${url.hostname}-${hash(src)}`
      src = src.split("")
        .reduce((s, c) => (Math.imul(31, s) + c.charCodeAt(0)) | 0, 0);
      src = `${url.hostname}-${src}`
    } catch (error) {
      console.error(error.message || error)
    }

    return src
  }
  get dataURL() {
    // return `/api/${this.id}.json`;
    let url = this.getAttribute("src")

    let domain, id;
    let urlObj;
    // try to slice up the URL and save the domain part
    try {
      urlObj = new URL(url, document.location.origin);
      domain = urlObj.hostname.replace(/www\.|m\./, "");
    } catch (err) {
      domain = url; // in case url wasn't a real URL
      // } finally {
    }

    let paths = urlObj.pathname.split('/')
    let index
    id = paths.find((string, i) => {
      index = i
      return AmplfrItem.isValidID(string)
    })

    // this.#data.id = id || this.#calculateID(url)
    if (!!id) {
      if (index > 1)
        id = `${paths[index - 1]}/${id}`
      this.#data.id = id
      url = `/api/${id}.json`
    } else
      this.#data.id = this.#calculateID(url)

    // check if domain is just an AmplfrID
    // if (AmplfrItem.isValidID(url)) {
    // if (AmplfrItem.isValidID(id)) {
    //     domain = 'amplfr'
    //     id = document.location.origin + `/api/${id}.json`
    // }

    // switch (domain) {
    //     case "localhost":
    //     case "amplfr":
    //     case "amplfr.com":
    //         this.#data.id = id
    //         break;
    //     default:
    //         this.#data.id = this.#calculateID(url)
    //         // obj = this.#parseBlob(url);
    //         break;
    // }
    // this.#data.domain = domain

    // return urlObj.toString()
    return url
  }
  #href(obj) {
    let href
    if (!!obj.id && (!!obj.title || !!obj.name))
      href = `/${obj.id}/${encodeURI(obj?.title || obj?.name).replaceAll("%20", "+",)}`;
    // else if (typeof href == "string")
    //   href = encodeURI(obj).replaceAll("%20", "+",)

    return href
  }
  get href() {
    return this.#data.href
  }
  get url() {
    return this.#data.url
  }
  get sourceURL() {
    return this.#data.url?.replace(/^\/api|\.json$/, "");
  }
  toString() {
    let string = ""

    // first append the Artist(s)' name(s)
    if (this.#data?.artists && this.#data?.artists.length > 0)
      string += `${this.#data?.artists.map(artist => artist.name).join(", ")} - `

    string += this.title

    return string
  }
  get readyState() { return this.#media?.readyState || 0; }
  get loaded() {
    // save the values here to keep get calls to a minimum
    const buffered = this.#media.buffered;
    const duration = this.#media.duration;
    let loaded = 0;

    // use a for-loop in case there are multiple disjoint buffered sections
    for (let r = 0; r < buffered.length; r++)
      loaded += buffered.end(r) - buffered.start(r); // add up the durations that are buffered

    return loaded / duration; // get the percent loaded
  }
  get items() {
    if (!this.#data.items)
      return

    return this.#data?.items.map(item => item.id)
  }
  #collection(wholeDocument = false) {
    let elements

    if (!!wholeDocument)
      elements = document.querySelectorAll(ElementStr)
    else
      elements = this.parentNode.querySelectorAll('amplfr-item')

    return elements
  }
  previous() {
    // loop back from this until we run out of elements or find another like this
    let element = this.previousElementSibling
    while (element != null) {
      if (!!element && element instanceof this.constructor) {
        this.#dom.previousE = element    // save previous for easy lookup later
        return this.#dom.previousE
      }

      element = element.previousElementSibling
    }

    return null
  }
  next() {
    // loop back from this until we run out of elements or find another like this
    let element = this.nextElementSibling
    while (element != null) {
      if (!!element && element instanceof this.constructor) {
        this.#dom.nextE = element    // save next for easy lookup later
        return this.#dom.nextE
      }

      element = element.nextElementSibling
    }

    return null
  }

  /**
   * Parse data-* and src attributes
   * TODO refactor out JSON parsing to its own function, returning Object
   */
  async #fetch() {
    // if this.#data is already parsed, nothing else to do here
    if (!!this.#data) return

    this.#data = {}     // initialize this.#data since we've got this far

    // build the API URL and fetch() its contents
    let url = new URL(this.dataURL, document.location.origin);
    const id = this.id  // save to assign later (needed if this is a collection (i.e., "album/..."))

    // needed to avoid CORS requests
    // TODO need to figure out CORS proxy, etc.
    if (url.origin != document.location.origin) {
      Object.entries(this.dataset).forEach(([k, v]) => {
        this.#data[k] = v
        delete this.dataset[k]  // not needed any longer
      })

      this.#data.href = url // so this.#renderTitle() makes title a link to this
      this.#data.src = url  // so this.load() points to the correct media
      return
    }

    let contentType
    let success = false
    try {
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`${response.status} ${response.statusText}: ${url}`);

      contentType = response.headers.get("content-type")
      if (contentType == "application/json") {
        this.#data = await response.json();

        if (Array.isArray(this.#data))
          this.#data = {
            // id: true,
            items: this.#data,
            // title: true,
            // url: url.href,
            url: url.pathname,
          }
        // if (!this.#data.id || !this.#data.title)
        if (!this.#data.id && !this.#data.title && !this.#data.items)
          throw new Error("Invalid data returned.")

        this.#data.id = id  // re-save precomputed id
        // this.#data.href = this.#href(this.#data)
        // url = this.#href(this.#data)
        // this.#data.href = url
        let href = this.#href(this.#data)
        // url = this.#href(this.#data) || url.href
        url = href || url.href
        // url = url.href
        url = url.replaceAll(/\/api|\.json/gi, "")

        // fetch/parse the media files (if there isn't a list of items)
        if (!this.#data.files && !this.#data.items)
          this.#fetchSrc()

        success = true
      }
      else if (contentType.startsWith("audio/")) {
        const blob = await response.blob()
        const metadata = await this.#extractBlob(blob)

        if (!!metadata) {
          this.#data = metadata
          this.#data.href = url
          this.#data.src = url
          success = true
        }
      }

      if (!success && !!this.dataset) {
        const metadata = this.#extractJSON(this.dataset)

        this.#data = metadata
        this.#data.href = url
        this.#data.src = url
      }

      this.#data.url = url
    } catch (error) {
      console.warn(error);
    }

    await this.#extract()
  }
  async #fetchSrc() {
    const id = this.#data.id;
    let response;
    let files = this.#data.files || this.#data.src;

    // if files isn't provided, fetch() it
    if (!files) {
      try {
        response = await fetch(`/api/${id}.files`)
        if (response.ok && !!response.body)
          this.#data.files = await response.json();
      } catch (error) {
        console.warn(error.message || error)
      }
    }
  };

  #extract() {
    if (!!this.#data?.items && this.#data.items?.length > 0) {
      let elementToInsertAfter = this
      this.#data.items.forEach((data, n) => {
        // create new object, passing in already received data object
        let item = new AmplfrItem(data)
        // item.partOf = this.url  // 
        item.dataset.collectionUrl = this.url
        item.dataset.collectionNumber = n + 1

        // do this instead of this this.parentNode.applend(this) to add items deterministically
        // otherwise items and collections could be added outof order
        elementToInsertAfter.insertAdjacentElement("afterend", item) // insert item after previous item
        elementToInsertAfter = item  // so the next item is appended after this one
      }, this)

      // if (this.parentElement.constructor.name.includes(Elements)) {
      this.parentNode.removeChild(this) // remove this empty element
      return  // anything else done to this will be for nothing
      // }
    }

    // set the definitive src and title attributes
    this.setAttribute("src", this.url)
    if (!!this.id)
      this.setAttribute("id", this.id)
    if (!!this.title)
      this.setAttribute("title", this.title)
  }
  #extractJSON(json) {
    const metadata = {}
    const artists = []

    if (!!json.title)
      metadata.title = json.title
    if (!!json.artist)
      // metadata.artists = [json.artist]
      metadata.artists.push(json.artist)
    if (!!json.album)
      metadata.album = json.album
    if (!!json.artwork || !!json.picture || !!json.image)
      metadata.artwork = json.artwork || json.picture || json.image

    // extract the embedded image if metadata.artwork is an object (not a string)
    if (!!metadata.artwork && typeof metadata.artwork != "string") {
      const { data, format } = metadata.artwork;
      let base64String = "";
      for (let i = 0; i < data.length; i++)
        base64String += String.fromCharCode(data[i]);

      metadata.artwork = `data:${format};base64,${window.btoa(base64String)}`;
    }

    return metadata
  }
  /**
   * Uses {@link https://github.com/aadsm/jsmediatags|aadsm/jsmediatags} to extract ID3, MP4, FLAC media tags and then call {@link #extractJSON} to map to required fields.
   * Supported tags provided by jsmediatags: 
   *  title
   *  artist
   *  album
   *  year
   *  comment
   *  track
   *  genre
   *  picture
   *  lyrics
   * @param {*} blob 
   * @see extractJSON
   * @returns {Object|null} metadata containing populated fields
   */
  async #extractBlob(blob) {
    // relies on [aadsm/jsmediatags: Media Tags Reader (ID3, MP4, FLAC)](https://github.com/aadsm/jsmediatags)
    // assumes that 
    let jsmediatags = window.jsmediatags

    let metadata // = {}
    await new Promise((resolve, reject) => {
      jsmediatags.read(blob, {
        onSuccess: (rv) => {
          resolve(rv)
        },
        onError: (error) => {
          reject(error)
        }
      })
    })
      .then(rv => {
        metadata = this.#extractJSON(rv.tags)
      })
      .catch(error => {
        // console.warn(error.info || error)
      })

    return metadata
  }

  #renderResourceMetadata() {
    const attributes = {
      src: "https://cdnjs.cloudflare.com/ajax/libs/jsmediatags/3.9.5/jsmediatags.min.js",
      integrity: "sha512-YsR46MmyChktsyMMou+Bs74oCa/CDdwft7rJ5wlnmDzMj1mzqncsfJamEEf99Nk7IB0JpTMo5hS8rxB49FUktQ==",
      crossorigin: "anonymous",
      referrerpolicy: "no-referrer",
    };

    let jsmediatags = document.querySelector(`script[src='${attributes.src}']`);
    if (!jsmediatags) {
      const element = document.createElement("script");
      Object.keys(attributes).forEach(k => {
        element.setAttribute(k, attributes[k]);
      });

      document.head.appendChild(element);
    }
  }

  /**
   * connectedCallback() is called when this element is (re-)added to the DOM
   */
  async connectedCallback() {
    await this.#fetch();

    // this.#render(); // render the basic elements - title, artwork, etc.
    this.#renderResources();
    this.#renderResourceMetadata()

    this.#dom = this
    // this.shadow.appendChild(this.#dom);
    // this.appendChild(this.#dom);
    this.#dom.classList.add("item");

    // if this is a collection
    if (!!this.#data?.items && this.#data.items?.length > 0)
      return

    // order (probably?) does matter
    this.#renderArtwork();
    this.#renderTitle();
    this.#renderTimeline();
    this.#renderArtists();
    this.#renderAlbum()
    this.#renderTime();

    // if there's another like this, be polite
    const prev = this.previous()    // save it since we're going to use it a few times here
    if (!!prev) {
      const me = this
      // prev.addEventListener("canplaythrough", (e) => { me.load() })
      prev.addEventListener("loadedmetadata", (e) => { me.load() })
      prev.addEventListener("ended", (e) => {
        prev.classList.remove("active") // dosen't work with e.target, so need prev
        me.classList.add("active")
        me.play()
      })
    }
    // else {
    //   // this is the only or first
    //   this.load(); // attempt to setup and download the related media
    //   this.classList.add("active")
    // }
  }

  #renderResources() {
    // add the following resource elements only if each isn't already present
    let resources = {
      "/css/item.css": "link",
      "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@48,400,1,0": "link",
      "https://cdnjs.cloudflare.com/ajax/libs/color-thief/2.3.0/color-thief.umd.js": "script",
    }
    let element
    Object.entries(resources).forEach(([href, elementType]) => {
      element = null
      if (elementType == "link") {
        if (document.querySelectorAll(`${elementType}[href='${href}']`).length == 0) {
          element = document.createElement("link");
          element.setAttribute("rel", "stylesheet");
          element.setAttribute("href", href);
        }
      } else if (elementType == "script") {
        if (document.querySelectorAll(`${elementType}[src='${href}']`).length == 0) {
          element = document.createElement("script");
          element.setAttribute("src", href);
        }
      }

      // append element to document's Head if it isn't null
      if (!!element)
        document.head.appendChild(element);
    })
  }
  #renderAlbum() {
    const album = this.#data.album
    if (!this.#dom || !album) return;
    if (!!this.#dom.querySelector(`.album[data-id="album/${album?.id}"]`)) return;

    let albumE;
    let href = album.href || album.url || album.src || this.#href(album);
    if (!!href) {
      href = href.replaceAll(/^\/api|\.json$/g, "")
      albumE = document.createElement("a");
      // albumE.setAttribute("href", href.replaceAll(/^\/api|\.json$/g, ""));
      albumE.setAttribute("href", href);
      // albumE.setAttribute("href", this.#href(href));
    } else albumE = document.createElement("span");
    albumE.classList.add("album");

    albumE.textContent = album.title || album;
    albumE.title = album.title || album;

    // create a child element for each Artist, populate it, and append it to e
    // const attributes = ["id", "year"];
    if (typeof album != "string") {
      // assignDataset(albumE.dataset, album, attributes); // assign albumE's dataset from this album's attributes

      let dateObj;
      let dateText;
      if (!!album.id)
        albumE.dataset.id = `album/${album.id}`;
      if (!!album.date) {
        dateObj = new Date(Date.parse(album.date)); // convert to a Date()
        dateText = dateObj.toISOString(); // save date as an ISOString
        // prettier-ignore
        dateText = dateText.substring(0, dateText.indexOf("T", 8));
        albumE.dataset.date = dateText || album.date;
      }
      if (!!albumE?.dataset.year)
        albumE.title += ` (${albumE.dataset.year || dateObj?.getFullUTCYear()})`;
    }

    this.#dom.appendChild(albumE);
  }
  #renderArtists() {
    // create a child element for each Artist, populate it, and append it to e
    if (this.#data.artists && Array.isArray(this.#data.artists) && this.#data.artists.length > 0)
      this.#data.artists.forEach(artist => this.#renderArtist(artist))
    else if (!!this.#data.artist)
      this.#renderArtist(this.#data.artist)
  }
  #renderArtist(artist) {
    if (!this.#dom || !artist) return;
    if (!!this.#dom.querySelector(`.artist[data-id="artist/${artist?.id}"]`)) return;

    let artistE;
    let href = artist.href || artist.url || artist.src || this.#href(artist)
    if (!!href) {
      href = href.replaceAll(/^\/api|\.json$/g, "")
      artistE = document.createElement("a");
      artistE.setAttribute("href", href);
    } else artistE = document.createElement("span");
    artistE.classList.add("artist");

    if (!!artist.id)
      artistE.dataset.id = `artist/${artist.id}`;
    artistE.textContent = artist.name || artist;
    artistE.title = artist.name || artist;

    this.#dom.appendChild(artistE);
  }
  #renderArtwork() {
    // skip the rest if artwork isn't wanted, or this has already been run
    if (!!this.#dom.querySelector('.artwork') || this.#data.artwork == false)
      return;

    // let artwork = "/albumart/"
    let artwork = this.#data?.artwork
    if (!artwork) {
      artwork = "/albumart/"
      artwork += (this.#data?.album?.id || `item/${this.#data.id}`) + ".jpg";
    }

    let artworkE = new Image();
    artworkE.classList.add("artwork");

    if (!artwork || artwork.indexOf("undefined") > -1) {
      artworkE.src = blankImage
    } else {
      artworkE.src = artwork;

      // if the artworkE has an error (probably got an HTTP404), use blankImage
      artworkE.addEventListener("error", (x) => {
        x.currentTarget.src = blankImage
      }, { once: true })
      artworkE.addEventListener("load", (x) => {
        if (!x.target.src.startsWith("data:"))
          decorateWithImageColor(artworkE);
      }, { once: true })
    }
    artworkE.alt = this.#data.title;

    // add artworkE, but make sure its the first child of this.#dom
    return this.#dom.insertAdjacentElement('afterbegin', artworkE);
  }
  #renderButton() {
    // skip if this already exists
    if (!!this.#dom.querySelector('button')) return;

    // add the control button
    const buttonE = document.createElement("button");
    buttonE.classList.add("material-symbols-outlined");
    buttonE.classList.add("play");

    const that = this
    buttonE.addEventListener("click", function (e) {
      e.preventDefault();
      that.#dom.play();
    });
    buttonE.addEventListener("touchend", function (e) {
      e.preventDefault();
      that.#dom.play();
    });

    // TODO add additional (hidable) buttons here

    // save the controls for easy access later
    // this.#dom.controls = {
    //     button: e,
    // };
    this.#dom.button = buttonE

    // this.#dom.appendChild(e);
    // e.setAttribute('id', 'play')
    // this.#dom.insertBefore(e, this.#dom.firstChild);
    // add element, but make sure its the first child of this.#dom
    this.#dom.insertAdjacentElement('afterbegin', buttonE);
  }
  #renderTime() {
    if (!!this.#dom.querySelector('.time')) return;
    const timeE = document.createElement("span");
    timeE.classList.add("time");

    if (this.duration > 0)
      timeE.innerText = Number(this.duration).toMMSS()
    this.#dom.appendChild(timeE);

    this.#dom.time = timeE; // save timeE for easy access later

    // const that = this;
    // timeE.addEventListener("click", (e) => {
    //     e.preventDefault()
    //     e.currentTarget.classList.toggle("remaining");
    //     that.#updateTime();
    // });
    // timeE.addEventListener("touchend", (e) => {
    //     e.preventDefault()
    //     e.currentTarget.classList.toggle("remaining");
    //     that.#updateTime();
    // });

    // add class 'icons' if this.#dom is a LI
    // if (this.#dom.tagName == "LI") this.#dom.classList.add("time");
  }
  #renderTimeline() {
    if (!!this.#dom.progress) return;

    // add the timeline container element (to this.#dom)
    const timelineContainerE = document.createElement("div");
    timelineContainerE.classList.add("timeline-container");
    // this._dom.progress = timelineContainerE; // save timelineContainerE for easy access later
    this.#dom.progress = timelineContainerE; // save timelineContainerE for easy access later

    // add the timeline element (to timeline container element)
    const timelineE = document.createElement("div");
    timelineE.classList.add("timeline");
    timelineContainerE.appendChild(timelineE);

    // add the thumb-indicator element (to timeline element)
    const thumb = document.createElement("div");
    thumb.classList.add("thumb-indicator");
    timelineE.appendChild(thumb);

    // append to (what should be) the end of the this.#dom element
    this.#dom.insertAdjacentElement('beforeend', timelineContainerE);
  }
  #renderTitle() {
    if (!this.#dom || !this.title) return;
    if (!!this.#dom.querySelector('.title')) return;

    let titleE;

    if (!!this.href) {
      titleE = document.createElement("a");
      titleE.setAttribute("href", this.href);
    } else titleE = document.createElement("span");
    titleE.classList.add("title");

    titleE.textContent = this.title;
    titleE.title = this.title;

    this.#dom.appendChild(titleE);
  }

  #updateButton(text, title) {
    if (!this.button) return

    this.button.innerHTML = text;
    this.button.title = title;
  };
  #updateTime(justDuration = true) {
    if (!this || !this.#media) return; // no media, nothing else to do here

    const seconds = this.currentTime;
    let duration = this.duration || 0;
    const percent = seconds / duration;

    duration = duration.toMMSS()

    // set the current time
    if (justDuration)
      this.time.innerText = duration;    // set the current time
    else
      this.time.innerText = `${seconds.toMMSS()} / ${duration}`;    // set the current time

    // set the timeline position
    if (!!this.progress)
      this.progress.style.setProperty("--progress-position", percent);
  }

  #log(msg) {
    console.log(`${this.#media?.currentSrc || this.url} - ${msg}`);
  }
  #logprogress(msg) {
    let bytes = this.#bytes;
    let loaded = 0;
    let played = 0;
    // from https://stackoverflow.com/a/27466608
    if (!!that.buffered.length) {
      loaded = (100 * that.buffered.end(0)) / that.duration;
      played = (100 * that.currentTime) / that.duration;
    }

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

    if (bytes > 0) msg += ` ${bytes.toHumanBytes()}\n`;
    if (bytes > 0) msg += ` ${((loaded / 100) * bytes).toHumanBytes()}`;
    msg += ` ${loaded.toFixed(0)}% loaded`;
    if (bytes > 0) msg += ` ${((played / 100) * bytes).toHumanBytes()}`;
    msg += ` ${played.toFixed(0)}% played`;

    this.#log(msg);
  }
  #warn(msg) {
    console.warn(`${this?.media?.currentSrc || this.sourceURL} - ${msg}`);
    this.#updateButton("report", `Warning: ${msg}`);
  }
  #progressUpdate(e) {
    // this.#log(`${e.type} ${this.#bufferedTime}s ${Number.parseFloat(this.#bufferedTime / this.duration * 100).toFixed(4)}%`);
    // this.#logprogress(`${e.type} ${this.#bufferedTime}s ${Number.parseFloat(this.#bufferedTime / this.duration * 100).toFixed(4)}%`);
  }

  async load() {
    // if this.#media is already setup
    if (!!this.#media) {
      this.#log("(re)load")
      this.#media.load()  // re-load()
      return
    }
    // this.#log("load")

    // fetch/parse the media files
    if (!this.#data.files)
      await this.#fetchSrc()

    const id = this.#data.id
    const mediaURLPrefix = '/api'   // DEBUG
    const media = new AmplfrAudio()   //(mediaURL)

    media.autoplay = false; // wait to play
    media.controls = false; // no native controls
    media.preload = "metadata";
    media.setAttribute('crossorigin', 'anonymous')

    if (!!this.#data.files && Array.isArray(this.#data.files)) {
      const map = {
        probably: 1,
        maybe: 2,
        "": 3, // no chance
      };
      // return the list media that client might be able to play
      this.#data.files
        .filter(file => media.canPlayType(file.mime || file) !== "") // skip anything client can't play
        .map(file => {
          // set the correct src
          file.src = `${mediaURLPrefix}/${file.filename}`
          return file;
        })
        .sort((a, b) => {
          // prefer media files that are playable by client
          if (map[a] < map[b]) return -1; // a < b
          else if (map[a] > map[b]) return 1; // a > b
          else return 0; // a = b
        })
        .forEach(file => {
          // append a source element for each URL/MIME-type
          const source = document.createElement("source");
          source.src = file.src || file.url || file;
          if (!!file.mime) source.type = file.mime;

          media.appendChild(source); // append to the media element
        })
    }
    else media.src = this.#data.src || `/api/${id}.mp3`   // DEBUG

    const that = this;
    this.#media = media

    this.#renderButton()

    media.addEventListener("abort", (e) => this.#warn(e.type));
    media.addEventListener("error", async (e) => {
      const media = e.currentTarget;
      if (media.networkState === media.NETWORK_NO_SOURCE)
        return this.#warn(
          `Cannot load the resource as given. \Please double check the URL and try again`
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
        this.#warn(
          `Cannot load "${URL}" (HTTP${res.status}: ${res.statusText}).\n` +
          `Please double check the URL and try again.`
        );
    });
    // media.addEventListener("stalled", (e) => this.#warn(e.type));
    media.addEventListener("waiting", (e) => {
      this.#warn(e.type)
      that.#updateButton("downloading", "Waiting");
    });

    // 1. loadstart       starting to download
    // 2. durationchange  once enough is downloaded that the duration is known
    // 3. loadedmetadata  once enough is downloaded that the duration, dimensions (video only) and text tracks are known
    //    - should mean HTTP 2xx result?
    // 4. loadeddata      when data for the current frame is loaded, but not enough data to play next frame
    // 5. progress        downloading
    // 6. canplay         when the browser can start playing the specified audio/video (when it has buffered enough to begin)
    // 7. canplaythrough  when the browser estimates it can play through the specified audio/video without having to stop for buffering
    media.addEventListener("loadstart", (e) => {
      if (e.currentTarget != media) return;
      that.#updateButton("downloading", `Downloading "${that.title}"`);
    });
    media.addEventListener("durationchange", (e) => {
      that.#progressUpdate(e)
      that.#updateTime();
    });
    media.addEventListener("loadedmetadata", (e) => {
      this.#log(e.type)
      that.#updateTime();

      // attempt a HEAD request for the media file to get its size
      // since some of media.currentSrc has been downloaded to get here, this fetch() shouldn't have issues
      // this is a best effort attempt, hence the .then()
      fetch(media.currentSrc, { method: "HEAD" })
        .then((res) => {
          if (res.ok) {
            // use either the Content-Range (total) or Content-Length header values
            let ContentRange = res.headers.get("Content-Range")?.split("/")[1]
            let ContentLength = res.headers.get("Content-Length")
            that.#bytes = parseInt(ContentRange ?? ContentLength)
          }
        })
    });
    media.addEventListener("loadeddata", (e) => {
      that.#progressUpdate(e)
    });
    media.addEventListener("progress", (e) => {
      // update what percentage (of time) has been downloaded thus far
      if (!!that.#media.buffered.length && that.#media.loaded !== true) {
        // is this completely loaded?
        if (that.loaded >= 1) {
          // dispatch a "loaded" event
          that.dispatchEvent(
            new Event("loaded", {
              bubbles: true,
              detail: {
                currentTime: that.#data.currentTime,
                duration,
              },
            })
          );
        }
      }
    });
    media.addEventListener("canplay", (e) => {
      // this.#log(e.type);
      that.#updateButton("play_arrow", `Play "${that.title}"`);
      that.#progressUpdate(e)
    });
    media.addEventListener("canplaythrough", (e) => {
      that.#progressUpdate(e)
      // this.#log(e.type)
    });
    // media.addEventListener("ratechange", (e) => this.#log(e.type));
    // media.addEventListener("resize", (e) => this.#log(e.type));
    media.addEventListener("play", (e) => {
      if (e.currentTarget != media) return;
      that.#updateButton("pause", `Pause "${that.title}"`);
    });
    media.addEventListener("playing", (e) => {
      this.#log(e.type)

      that.#updateButton("pause", `Pause "${that.title}"`);
      that.classList.add("playing")
      that.setAttribute("playing", true)

      that.classList.remove("played")
    });
    media.addEventListener("pause", (e) => {
      if (e.currentTarget != media) return;
      that.#updateButton("play_arrow", `Play "${that.title}"`);
      this.classList.remove("playing")
      this.removeAttribute("playing")
    });
    media.addEventListener("seeked", (e) => {
      this.#log(`${e.type} - ${e.target.currentTime} to ${Number(media.currentTime).toMMSS()} (${media.currentTime})`)
      that.#updateTime(false); // one-off to update the time
    });
    // media.addEventListener("seeking", (e) => this.#log(e.type));
    // media.addEventListener("suspend", (e) => this.#log(e.type));
    media.addEventListener("timeupdate", (e) => {
      that.#updateTime(false);
    });
    media.addEventListener("ended", (e) => {
      this.#log("ended");

      that.classList.remove("playing")
      this.removeAttribute("playing")

      that.classList.add("played")

      if (!that.#collection()) {
        that.#updateButton("replay", `Replay "${that.title}"`);
      }
    });
    // media.addEventListener("emptied", (e) => this.#log(e.type));
    // media.addEventListener("volumechange", (e) => this.#log(e.type));

    // setup any event listeners User already submitted
    if (!!this.listeners) {
      Object.entries(this.listeners).forEach(
        ([event, { listener, options }]) =>
          media.addEventListener(event, listener, options)
      );

      delete this.listeners   // no further need
    }

    // map all of this.media's methods to this
    const skipList = [
      'constructor',  // don't want media's constructor
      'addEventListener',
    ]
    const descriptors = Object.getOwnPropertyDescriptors(media.constructor.prototype);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (!skipList.includes(key)) {
        let functions = {}
        if (descriptor?.get)
          Object.assign(functions, { get() { return media[key] } })
        if (descriptor?.set)
          Object.assign(functions, { set(v) { media[key] = v } })
        if (typeof descriptor?.value == "function")
          that[key] = () => { media[key]() }

        if (Object.keys(functions).length > 0)
          Object.defineProperty(this, key, functions)
      }
    }
  }
  /**
   * Unloads the associated media. Need to run {@link} load() to re-load the media.
   * @see {@link load}
   * @emits unloaded
   */
  unload() {
    this.#media = null
    this.#log("unload")

    // dispatch an "unloaded" event
    that.dispatchEvent(
      new Event("unloaded", {
        bubbles: true,
      })
    );
  }

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
      if (!this.#media) {
        this.listeners = this.listeners || {};
        this.listeners[type] = { listener, options };
        return;
      }

      this.#media.addEventListener(type, listener, options);
    }
    // anything not known, send it onwards to the parent class
    else super.addEventListener(type, listener, options)
  }
}


const decorateWithImageColor = async (img, palettes) => {
  // if ColorThief exists
  if (!ColorThief) return;

  // TODO run ColorThief async
  if (!palettes) {
    const colorThief = new ColorThief();
    if (img.complete) {
      try {
        palettes = await colorThief.getPalette(img, 5);
        return decorateWithImageColor(img, palettes);
      } catch (error) {
        // probably cannot access img data, maybe due to CORS
        // console.warn(error.message || error)
        return
      }
    } else {
      img.addEventListener("load", async function () {
        // palettes = await colorThief.getPalette(img, 5);
        return decorateWithImageColor(img);
      }, { once: true });
      return;
    }
  }

  // from https://alienryderflex.com/hsp.html
  const hsp = (rgb) => {
    const [r, g, b] = rgb;

    return Math.sqrt(
      0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b)
    );
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

  // this.style.setProperty("--color", rgbToHex(...color));
  // this.style.setProperty("--colorAccent", rgbToHex(...colorAccent));
  img.parentElement.style.setProperty("--color", rgbToHex(...color));
  img.parentElement.style.setProperty("--colorAccent", rgbToHex(...colorAccent));
}


class AmplfrAudio extends Audio {
  #loopCounter
  #listening

  constructor(src) {
    super() // call super() beccause you have to, but don't pass src to start downloading
    this.className = 'AmplfrAudio'
  }

  /**
   * Plays the media.
   */
  play() {
    // pause if not already
    if (!this.paused) {
      this.pause();
      return;
    }
    if (!!this.ended) this.fastSeek(0); // restart from the beginning if ended

    // stop any others that are already playing
    // "There can only be one"
    // document.querySelectorAll('amplfr-item').forEach(item => {
    //   // console.this.#log(`${item.title} - is ${item.playing ? "" : "NOT"} playing`)
    //   if (item.playing) item.stop()
    //   item.classList.remove("active")
    // })
    // this.classList.add("active")

    // play (so long as there are no errors)
    if (!super.error) super.play();
  }
  /**
   * Pauses the media.
   */
  // prettier-ignore
  pause() { super.pause() }
  /**
   * Stops the media.
   * Equivilent to {@link AmplfrItem#pause|pause()} and {@link AmplfrItem#seekTo|seekTo(0)}
   */
  stop() {
    this.pause();
    this.fastSeek(this?.startTime || 0); // reset the time back to beginning
  }
  /**
   * Fast seeks to the specified time.
   * @param {number} s The time to seek to in seconds (float or integer).
   * @see {@link seekTo}
   */
  // prettier-ignore
  fastSeek(s) { this.seekTo(s, false) }
  /**
   * Seeks to the specified time.
   * @param {number} s The time to seek to in seconds (float or integer).
   * If less than 0, will seek to start time or 0. If greater than the duration, will seek to end time or (duration).
   * @param {boolean} [precise=FALSE] If true uses the more precise currentTime, otherwise use fastSeek
   */
  seekTo(s, precise = false) {
    // if (!this) return;
    // let startTime = this._data.start || 0;
    // let endTime = this._data.end || this.duration || 0;
    // s = Math.max(startTime, Math.min(s, endTime)); // keep s within known range

    if (!precise && super.fastSeek)
      super.fastSeek(s); // faster (??)
    else super.currentTime = s; // more precise
  }

  // media property get'ers - each returns null if this is null
  // get startTime() {
  // try to extract start and end times if url is actually a URL
  // let startTime = this.#data.startTime;
  // let searchParams = {};
  // if (!startTime) {
  //     try {
  //         searchParams = this.sourceURL.searchParams;
  //     } catch (error) { }

  //     startTime = searchParams["s"] || !!searchParams["start"] || 0;
  //     this.#data.startTime = startTime;
  // }
  // return startTime;
  // }
  // get endTime() {
  // try to extract start and end times if url is actually a URL
  // let endTime = this.#data.endTime;
  // let searchParams = {};
  // if (!endTime) {
  //     try {
  //         searchParams = this.sourceURL.searchParams;
  //     } catch (error) { }

  //     endTime = searchParams["e"] || !!searchParams["end"] || this.duration;
  //     this.#data.endTime = endTime;
  // }
  // return endTime;
  // }
  // prettier-ignore
  // get loaded() { return this?.loaded || 0.0 }
  // prettier-ignore
  get buffered() { return super.buffered }
  // prettier-ignore
  get currentTime() { return super.currentTime }
  // prettier-ignore
  get duration() { return super.duration }
  // prettier-ignore
  get durationMMSS() { return (!!this.duration) ? Number(this.duration).toMMSS() : null }
  // prettier-ignore
  get ended() { return super.ended }
  // prettier-ignore
  get error() { return super.error }
  // prettier-ignore
  get loop() { return (!!this.#loopCounter && this.#loopCounter > 0) || super.loop }
  // prettier-ignore
  get muted() { return super.muted }
  // prettier-ignore
  get networkState() { return super.networkState }
  // prettier-ignore
  get paused() { return super.paused }
  get playing() {
    // ==false means its playing, but null means nothing
    return this.paused === false ? true : false;
  }
  // // prettier-ignore
  get playbackRate() { return super.playbackRate }
  // // prettier-ignore
  get readyState() { return super.readyState }
  // // prettier-ignore
  get seekable() { return super.seekable }
  // // prettier-ignore
  get volume() { return super.volume }

  // media property set'ers
  /**
   * Seeks to the specified time.
   * @param {number} v The time to seek to in seconds (float or integer).
   * @see {@link seekTo}
   */
  // prettier-ignore
  set currentTime(v) { this.seekTo(v, true); }
  /**
   * Fast seeks to the specified time.
   * @param {number|boolean} [v=!loop] The number of times to loop through all of the items, true to loop indefinitely, or false to not loop again.
   */
  // set loopAll(v = !this.loopAll) {
  set loop(v = !this.loop) {
    // if (!this) return;
    super.loop = !!v;
    if (typeof v == "number") {
      this.#loopCounter = Math.max(1, v); // save the number of times to loop (>=0)

      this.addEventListener("seeked", (e) => { this.#decrementLoops() });

      if (v <= 0) this.#decrementLoops();
    }
  }
  #decrementLoops() {
    --this.#loopCounter; // one less time to loop

    // no more looping
    if (this.#loopCounter <= 0) {
      this.#loopCounter = 0;
      super.loop = false;
      this.removeEventListener("seeked", (e) => { this.#decrementLoops() });
    }
  };
  // prettier-ignore
  set muted(v = !super.muted) { super.muted = (!!v) }
  // prettier-ignore
  set playbackRate(v = 1) { super.playbackRate = v }
  // prettier-ignore
  set volume(v = 1) { this.volume = v }


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
    this.#listening = this.#listening || []
    const t = `${type},${listener.toString()},${options}`

    if (mediaListeners.includes(type) && !this.#listening.includes(t)) {
      this.#listening.push(t)  // remember to avoid overflow of repeats

      this.addEventListener(type, listener, options);
    }
    // anything not known, send it onwards to the parent class
    else super.addEventListener(type, listener, options)
  }
}


/**
 * 
 * TODO implement [iterator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Iterators_and_generators#iterators)
 * TODO implement this.loop
 * TODO drop the this.#media object from an AmplfrItem that has been played and !this.loop
 */
class AmplfrCollection extends AmplfrItem {
  #dom = {}
  #loop = false
  #controls = [
    {
      id: 'toggleQueue',
      title: "show or hide Queue",
      text: 'playlist_play',
      updateStatus: (e) => {
        e.classList.toggle('activated', this.classList.contains('minimized'))
      },
      fn: () => { this.classList.toggle('minimized') }
    },
    {
      id: 'previous',
      title: "Previous",
      text: 'skip_previous',
      updateStatus: (e) => {
        e.classList.toggle('disabled', !this.previous(false))
      },
      fn: this.previous
    },
    {
      id: 'loop',
      title: "Repeat",
      text: 'repeat',
      updateStatus: (e) => {
        e.classList.toggle('activated', this.loop)
      },
      fn: () => { this.loop = (!this.loop) }
    },
    {
      id: 'share',
      title: "Share",
      text: 'share',
      fn: this.share
    },
    {
      id: 'shuffle',
      title: "Shuffle",
      text: 'shuffle',
      fn: this.shuffle
    },
    {
      id: 'next',
      title: "Next",
      text: 'skip_next',
      updateStatus: (e) => {
        e.classList.toggle('disabled', !this.next(false))
      },
      fn: this.next
    },
    // {
    //   id: "search",
    //   title: "Search",
    //   text: "search",
    //   fn: () => { }
    // },
  ]

  constructor(src) {
    super(src)

    if (!!src)
      // if (!!src.id && AmplfrItem.isValidID(src.id)) {
      //   // src is an object for an AmplfrItem
      //   this.#data = src
      //   this.#extract()
      // }
      // else 
      if (typeof src == "string")
        this.setAttribute("src", src)
  }


  #render() {
    if (!!this.#dom.controls || this.#dom.controls == false) return
    const e = document.createElement("div");
    e.setAttribute('id', 'controls')
    e.classList.add("controls");

    if (this.items.length == 1)
      e.classList.add('hidden')

    this.insertAdjacentElement("afterbegin", e)    // before first child

    // this.#dom.controls = this.#dom.controls || {};  // e; // save for easy access later
    this.#dom.controls = e; // save for easy access later
    this.#dom.controlsToUpdate = this.#dom.controlsToUpdate || {}

    const that = this;
    this.#controls.forEach(ctrl => {
      if (!ctrl.fn) return  // skip if ctrl.fn doesn't exist

      const ce = document.createElement("button");
      ce.setAttribute('id', ctrl.id)
      ce.setAttribute('title', ctrl.title)
      ce.classList.add("material-symbols-outlined");

      if (ctrl.class)
        ce.classList.add(...ctrl.class)
      if (ctrl.updateStatus && typeof ctrl.updateStatus == 'function') {
        ctrl.updateStatus(ce)

        this.#dom.controlsToUpdate[ctrl.id] = ctrl.updateStatus
      }
      ce.innerText = ctrl.text
      e.appendChild(ce);
      // this.#dom.controls[ctrl.id] = ce

      function action(ev) {
        ev.preventDefault();
        if (ev.target.classList.contains('disabled')) return // don't do anything if target is disabled
        ctrl.fn.bind(that)(ev);
        // ctrl.fn.bind(this)(ev);

        that.#updateControls()
      }
      ce.addEventListener("click", (ev) => action(ev));
      ce.addEventListener("touchend", (ev) => action(ev));
      // })
    }, this)

    this.#renderSearch()
  }
  #renderSearch() {
    if (!this.#dom.controls || !!this.#dom.controls?.search) return

    const e = document.createElement("input");
    e.type = "search"
    e.id = "search"
    e.placeholder = "Search songs, artists, lyrics, albums, and more"

    this.#dom.controls.appendChild(e)
  }
  #updateControls() {
    // run through all of the controls that may be affected by an outside change
    Object.entries(this.#dom.controlsToUpdate).forEach(([id, fn]) => {
      // fn(this.#dom.controls[id])
      fn(this.#dom.controls.children.namedItem(id))
    }, this)
  }

  #activate(item) {
    const wasActive = this.active
    const detail = {}

    this.#deactivateOthers()
    item.classList.add("active")

    if (!!wasActive)
      detail.wasActive = wasActive
    detail.nowActive = this.active

    this.dispatchEvent(
      new Event("change", {
        bubbles: true,
        detail,
      })
    );
  }
  #deactivateOthers() {
    this.querySelectorAll("amplfr-item.active").forEach(item => item.classList.remove("active"))
  }

  #observer(mutationList) {
    for (const mutation of mutationList) {
      if (mutation.type === "childList") {
        // console.this.#log("A child node has been added or removed.");
        if (!!mutation.addedNodes && mutation.target.items.length > 1) {
          // add controls
          mutation.target.#render.apply(mutation.target)
          mutation.target.#updateControls.apply(mutation.target)
        }
        if (!!mutation.removedNodes && mutation.target.items.length > 1) {
          // remove controls
          mutation.target.#render.apply(mutation.target)
          mutation.target.#updateControls.apply(mutation.target)
        }
      }
    }
  }
  #fetch() { }

  /**
   * connectedCallback() is called when this element is (re-)added to the DOM
   */
  connectedCallback() {
    // if (!!this.#observer) {
    //   // watch this for any added/removed child nodes
    //   this.#dom.observer = new MutationObserver(this.#observer)
    //   this.#dom.observer.observe(this, {
    //     childList: true,
    //   })
    // }
    // super.connectedCallback()

    this.#render(); // render the basic elements - title, artwork, etc.
  }

  get active() {
    // get what the current .active item is, or the first amplfr-item element
    return this.querySelectorAll("amplfr-item.active")[0] || this.items[0]
  }
  get items() {
    return Array.from(this.children).filter(element => element instanceof AmplfrItem)
  }
  item(i) {
    return this.items[i]
  }
  /**
   * 
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLCollection/namedItem}
   * @param {*} key The ID, Title, or Name of the element to return
   * @returns ({@link AmplfrItem}|null)
   */
  itemName(key) {
    return this.querySelector(`#${key},[title="${key}"],[name="${key}"]`)
  }
  get length() { return this.items.length }

  previous(changeActive = true) {
    // loop back from this until we run out of elements or find another like this
    // let element = this.active?.previousElementSibling // need this.active.? in case its null
    let element = this.active
    element = element?.previousElementSibling || element // need this.active.? in case its null

    // if (!!changeActive)
    //   // clear out any active items since element is the starting point
    //   this.#deactivateOthers()

    while (element != null) {
      if (element instanceof AmplfrItem) break

      element = element.previousElementSibling
    }

    // if element is still null and loop is enabled
    if (!element && !!this.#loop)
      element = this.querySelector("amplfr-item") // set the first AmplfrItem (or will still be null)
    if (!!changeActive && !!element)
      this.#activate(element)

    return element
  }
  next(changeActive = true) {
    // loop back from this until we run out of elements or find another like this
    // let element = this.active?.nextElementSibling || this.active   // need this.active.? in case its null
    let element = this.active
    element = element?.nextElementSibling || element   // need this.active.? in case its null

    // if (!!changeActive)
    //   // clear out any active items since element is the starting point
    //   this.#deactivateOthers()

    while (element != null) {
      if (element instanceof AmplfrItem) break

      element = element.nextElementSibling
    }

    // if element is still null and loop is enabled
    if (!element && !!this.#loop)
      element = this.querySelector("amplfr-item") // set the first AmplfrItem
    if (!!changeActive && !!element)
      this.#activate(element)

    return element
  }
  [Symbol.iterator]() {
    // Use a new index for each iterator. This makes multiple
    // iterations over the iterable safe for non-trivial cases,
    // such as use of break or nested looping over the same iterable.
    let index = 0;

    return {
      // Note: using an arrow function allows `this` to point to the
      // one of `[@@iterator]()` instead of `next()`
      next: () => {
        if (index < this.items.length) {
          return { value: this.items[index++], done: false };
        } else {
          return { done: true };
        }
      },
    };
  }

  get loop() {
    return !!this.#loop && (this.#loop > 0 || this.#loop == true)
  }
  get ended() { return this.active.ended }

  // functions, setters and getters that interact with this.active
  /**
   * 
   * @param {null|Number|String} (item) Null to play active AmplfrItem, or index (as number) or ID/Title (as string) of AmplfrItem to play.
   */
  play(item = null) {
    let active = this.active

    if (typeof item == "number") {
      active = this.items.item(item)

      this.#deactivateOthers()
      this.#activate(active)
    }
    else if (typeof item == "string") {
      active = this.items.namedItem(item)

      this.#deactivateOthers()
      this.#activate(active)
    }

    this.active.play()
  }
  pause() { this.active.pause() }
  stop() { this.active.stop() }
  fastSeek(s) { this.active.fastSeek(s) }
  seekTo(s, precise) { this.active.seekTo(s, precise) }
  get buffered() { return this.active.buffered }
  get currentTime() { return this.active.currentTime }
  get duration() { return this.active.duration }
  get durationMMSS() { return this.active.durationMMSS }
  get error() { return this.active.error }
  get muted() { return this.active.muted }
  get networkState() { return this.active.networkState }
  get paused() { return this.active.paused }
  get playing() { return this.active.playing }
  get playbackRate() { return this.active.playbackRate }
  get readyState() { return this.active.readyState }
  get seekable() { return this.active.seekable }
  get volume() { return this.active.volume }

  set currentTime(v) { return this.active.currentTime(v) }
  set loop(v = !this.loop) {
    this.#loop = !!v;

    if (!!this.#dom.controls && this.#dom.controls['loop'] != null)
      // if (this.loop)
      //     this.#dom.controls['loop'].classList.add('activated')
      // else
      //     this.#dom.controls['loop'].classList.remove('activated')
      if (this.#dom?.controls['loop'])
        this.#dom.controls['loop'].classList.toggle('activated', this.loop)
  }
}

customElements.define("amplfr-item", AmplfrItem);
customElements.define("amplfr-audio", AmplfrAudio);
// customElements.define("amplfr-audio", AmplfrAudio, { extends: "audio" });
// customElements.define("amplfr-audio", AmplfrAudio, { extends: "audio" });
customElements.define("amplfr-collection", AmplfrCollection);

Number.prototype.toMMSS = function () {
  if (Number.isNaN(this.valueOf())) return "";
  let neg = this < 0 ? "-" : "";
  let t = Math.abs(this);
  let s = Math.round(t % 60);
  let m = Math.floor(t / 60);

  if (m >= 60) m = `${m / 60}:${(m % 60).toString().padStart(2, "0")}`;
  return `${neg}${m}:${s.toString().padStart(2, "0")}`;
};
