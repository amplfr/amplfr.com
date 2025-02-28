const blankImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=" // a blank 1x1 PNG

/**
 * /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{22}\/?[-a-zA-Z0-9_.!~*'();/?:@&=+$,#]*$/
 * @typedef {string}    AmplfrID
 * @example 
 * kREnNawsJqg7PFfX3LYqEy/Just
 * kREnNawsJqg7PFfX3LYqEy
 * eDu4Y113AnxWJCdqpnCrHv
 * 6HrUVPVYS3PNDJJ4zmQrJw/Smells+Like+Teen+Spirit
 */
/**
 * /^[a-z]*\/[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{22}\/?[-a-zA-Z0-9_.!~*'();/?:@&=+$,#]*$/
 * @typedef {string}    AmplfrCollectionID
 * @example 
 * kREnNawsJqg7PFfX3LYqEy/Just
 * kREnNawsJqg7PFfX3LYqEy
 * eDu4Y113AnxWJCdqpnCrHv
 * 6HrUVPVYS3PNDJJ4zmQrJw/Smells+Like+Teen+Spirit
 */
/**
 * /^artist\/[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{22}\/?[-a-zA-Z0-9_.!~*'();/?:@&=+$,#]*$/
 * @typedef {string}    AmplfrArtistID
 */
/**
 * /^album\/[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{22}\/?[-a-zA-Z0-9_.!~*'();/?:@&=+$,#]*$/
 * @typedef {string}    AmplfrAlbumID
 */
/**
 * /^playlist\/[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{22}\/?[-a-zA-Z0-9_.!~*'();/?:@&=+$,#]*$/
 * @typedef {string}    AmplfrPlaylistID
 */
/**
 * @typedef {Object}    AmplfrSource
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLSourceElement|HTMLSourceElement}
 * @property {number}   bytes   The size of the file in bytes.
 * @property {string}   [height]    The (optional) height of the image/video resource in pixels.
 * @property {number}   rate    The playback rate in kb/s.
 * @property {string}   src     The filename of the file.
 * @property {string}   type    The MIME-type for the file.
 * @property {string}   [width] The (optional) width of the image/video resource in pixels.
*/
/**
 * AmplfrMetadata
 * @typedef {Object}    AmplfrMetadata
 * @property {string}   title   Title of the Item
 * @property {string}   url     Canonical URL as source.
 * @property {AmplfrID} id      Unique ID for the Item. 
 * @property {string[]} [artists]   The artist(s) responsible for the Item.
 * @property {AmplfrArtistID[]|AmplfrArtist[]} [artists]   The artist(s) responsible for the Item.
 * @property {AmplfrSource[]} [src] The media file(s) that Item points to.
 */
/**
 * @typedef {Object}    AmplfrArtist
 * @property {string}   name    Name of the Artist
 * @property {AmplfrArtistID} id    Unique ID for the Artist, prepended with "artist/"
 * @example
 * true     artist/dKsQCazuEHnvVqJUuiVBPV
 * true     artist/dKsQCazuEHnvVqJUuiVBPV/Radiohead
 * @property {string|Date} [start]
 * @property {string|Date} [end]
 */
/**
 * @typedef {Object}    AmplfrCollection
 * @property {string}   title   Title of the Collection
 * @property {AmplfrID} id      Unique ID for the Collection
 * @property {AmplfrMetadata[]|string[]} items The Item(s) that comprise the Collection.
*/
/**
 * @typedef {Object}    AmplfrAlbum
 * @augments AmplfrCollection
 * @property {AmplfrAlbumID} id      Unique ID for the Album, prepended with "album/"
 * @property {string|Date} [released]
*/
/**
 * @typedef {Object}    AmplfrPlaylist
 * @augments AmplfrCollection
 * @property {AmplfrPlaylistID} id  Unique ID for the Playlist, prepended with "playlist/"
 * @property {string|Date} [created]
 * @property {string|Date} [modified]
 */

/**
 * Fetches and parses metadata from 
 */
class AmplfrItem extends HTMLElement {
    // #domain = `${document.location.protocol}//amplfr.com`
    #domain = `${document.location.protocol}//${document.location.host}` // "localhost:8080"
    #idToURL = (id) => `${this.#domain}/${id}`  // `https://${this.#domain}/${id}`
    // #idToAPI = (id) => `https://${this.#domain}/api/${id.split("/")[0]}.json`
    // #idToAPI = (id) => {
    //     id = id.map(item => AmplfrItem.isValidID(item?.url || item))
    //     ?.reduce((acc, cur) => acc && cur, true) || id

    //     return `https://${this.#domain}/api/${id}.json`}
    // #idToAPI = (id) => `https://${this.#domain}/api/${id
    //     .split("/")
    //     .map((path, position, arr) => {
    //         return !!AmplfrItem.isValidID(path) ? (id.split("/", position).join("/") || path) : ""
    //     })
    //     }.json`
    #idToAPI = (id) => `${this.#domain}/api/${id}.json` // `https://${this.#domain}/api/${id}.json`
    #urlToID = (url) => (url.pathname || url)
    #url;   // the provided/set URL
    #id;    // the ID derived from the URL or set after metadata fetched
    #data;  // holds the returned #fetch()ed object
    // render = [
    #listToRender = [
        "artwork",
        "title",
        "artists",
        "album",
    ];


    /**
     * 
     * @param {String|AmplfrMetadata|null} src URL (if string), AmplfrMetadata Object
     *      If src is a URL, then URL will be queried to fetch AmplfrMetadata data.
     *      If src is a JSON string, then will be JSON.parse()ed to create AmplfrMetadata object.
     *      If src is not set, then must call {@link url()} to set URL.
     */
    constructor(src) {
        super()
        // TODO determine if url is an Object or a String
        //  String indicates url is a URL that needs to be #fetch()ed
        //  Object indicatess url is an object that needs to be #parse()ed
        //      - url *could* possibly be a JSON string that needs to be JSON.parse()ed before being #parse()ed
        //      - if (url is a String && begins with JSON text) url = JSON.parse(url)
        if (typeof src == "string" && src.length > 0) {
            this.url = src
            if (!this.url) {
                try {
                    src = JSON.parse(src)
                } catch (error) {
                    return
                }
            }
        }
        else if (!!src && Object.keys(src).length > 0)
            return this.#extract(src)

        if (!!this.url)
            this.#fetch()
    }

    /**
     * Fetches metadata from URL. If URL 
     * @see {@link url} for which URL is used.
     * @async
     */
    async #fetch() {
        // if this.#data is already parsed, nothing else to do here
        if (!!this.#data) return

        const url = this.#api
        if (!url) return

        // special value indicating data is being fetched
        this.#data = true
        let json
        try {
            let contentType
            const response = await fetch(url, {
                cache: "force-cache",
                headers: {
                    "Accept": "application/json; q=1.0, text/*; q=0.8, */*; q=0.1"
                }
            });
            if (!response.ok)
                throw new Error(`${response.status} ${response.statusText}: ${url}`);

            const headers = response.headers
            // console.debug(`${response.status} - ${url}`)

            // for (let [header, value] of headers) {
            //     header = header
            //         .split("-")
            //         .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            //         .join("-")
            //     console.log(`${(header)}=${value}`);
            // }

            const bytes = headers.get("Content-Length")
            contentType = headers.get("Content-Type")

            // dispatch a "fetched" event
            this.dispatchEvent(
                new Event("fetched", {
                    bubbles: false,
                    detail: {
                        response,
                        bytes,
                        type: contentType,
                    },
                })
            );
            if (contentType == "application/json")
                json = await response.json();
            else {
                // treat response.body like a media file and try to extract its metadata (as a blob)
                const blob = await response.blob()

                // if caller wants to save the downloaded file
                if (this.srcObject === true)
                    this.srcObject = URL.createObjectURL(blob)

                json = await this.#extractBlob(blob)
            }
        } catch (error) {
            console.warn(error);
        }

        if (!!json)
            this.#extract(json)

        // cleanup if necessary
        if (this.#data === true)
            this.#data = null
    }
    /**
     * Parses metadata from json and populates appropriate fields to create AmplfrItemObj object.
     * @param {Object} json 
     * @emits "populated" Emitted once metadata is successfully populated.
     */
    #extract(json) {
        // if this.#data is already parsed, nothing else to do here
        if (!!this.#data && this.#data !== true) return

        // TODO check if json is really for a Collection and not just a single Item
        if (!!AmplfrCollection.isCollection(json)) {
            //  if this is really a Collection, then do the following:
            const collection = new AmplfrCollection(json)
            // if (!!this.parentElement) {
            if (!!this.parentElement && this.parentNode instanceof AmplfrCollection) {
                this.insertAdjacentElement("afterend", collection)

                // this.parentElement.removeChild(this)
                this.remove()
                return  // nothing else to do here
            }
        }

        this.#data = json   // initialize this.#data since we've got this far

        if (!!json?.url)
            this.url = json.url
        if (!!this.id)
            this.#data.id = this.id

        // dispatch a "populated" event
        this.dispatchEvent(
            new Event("populated", {
                bubbles: true,
            })
        );
    }
    #extractJSON(json) {
        const metadata = {}
        metadata.artists = []

        if (!!json.title)
            metadata.title = json.title
        if (!!json.artist)
            metadata.artists.push(json.artist)
        if (!!json.artists)
            metadata.artists.push(...json.artists)
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
        let jsmediatags = window.jsmediatags

        let metadata
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
                console.warn(error.info || error)
            })

        return metadata
    }

    /**
     * Returns the API URL, or just the URL
     * @private
     * @readonly
     */
    get #api() {
        let id = this.id

        if (!!id)
            return this.#idToAPI(id)

        return this.url
    }
    /**
     * Returns the specified URL
     * @readonly
     * @returns {URL|string}  URL
     */
    get url() { return this.#url?.href || this.#url }
    /**
     * Returns the specified URL
     * @private
     * @readonly
     * @returns String  URL HREF
     */
    #href(obj = this) {
        let id = obj.id
        let title = encodeURI(obj?.title || obj?.name).replaceAll("%20", "+",)  // obj.title

        if (!id || !title)
            return obj.url

        // return `${this.#idToURL(obj.id)}/${encodeURI(obj?.title || obj?.name).replaceAll("%20", "+",)}`;
        return `${this.#idToURL(obj.id)}/${title}`;
    }
    /**
     * Returns the ID
     * @readonly
     * @returns {AmplfrID|string}
     */
    get id() { return this.#id }
    /**
     * Returns the title
     * @readonly
     * @returns string
     */
    get title() { return this.#data?.title || this.#data?.name }
    /**
     * Returns the Album object
     * @readonly
     * @returns {AmplfrAlbum|Object|string}
     */
    get album() { return this.#data?.album }
    /**
     * Returns the Artists object
     * @readonly
     * @returns {AmplfrArtist[]|AmplfrArtistID[]}
     */
    get artists() { return this.#data?.artists || [this.#data?.artist] }
    /**
     * Returns the artwork URL (or possibly data URL {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs|MDN Data URL}).
     * @readonly
     * @returns String
     */
    get artwork() { return this.#data?.artwork }
    /**
     * Returns the duration (in seconds)
     * @readonly
     * @returns number
     */
    get duration() { return this.#data?.duration }
    /**
     * Returns the duration (in seconds)
     * @readonly
     * @returns string
     */
    get durationMMSS() { return (this.duration || 0).toMMSS() }

    /**
     * Sets the src URL to use if not already set.
     * @param string url
     */
    set url(url) {
        if (!!this.url) return  // don't set if already set

        let potentialID
        try {
            // use .origin instead of .href to ignore path(s)
            url = new URL(url, document.location.origin)
            potentialID = url?.pathname

            if (!!url.hash)
                this.render = url.hash
        } catch (error) {
            if (!(error instanceof TypeError))
                console.warn(error.message || error)
            potentialID = url
        }
        potentialID = decodeURIComponent(potentialID).replace(/^\/api|\.json$|^\//, "")
        // potentialID = potentialID  // save the ID
        //     .split("/")
        //     // .filter(part => this.isValidID(part), this)
        //     .filter(part => AmplfrItem.isValidID(part))
        //     .join("/")

        // if url is ValidID, then convert the ID to a URL and assign to url 
        // if (!!this.#isValidIDTitle(potentialID)) {
        // if (!!potentialID && !!this.#isValidIDTitle(potentialID)) {
        // if (!!potentialID && (!!AmplfrItem.isValidID(potentialID) || !!AmplfrCollection.isValidID(potentialID))) {
        if (!!potentialID && (!!AmplfrItem.isValidIDTitle(potentialID) || !!AmplfrCollection.isValidID(potentialID))) {
            // url = url.replace(/^\/api|\.json$/, "")
            // url = this.#idToURL(pathname)    // convert the ID to a URL and save it
            // this.#id = this.#urlToID(potentialID)  // save the ID
            let foundID = false
            this.#id = potentialID  // save the ID
                .split("/")
                .reduce((acc, part) => {
                    if (!!foundID)
                        return acc
                    foundID = AmplfrItem.isValidID(part)
                    return `${acc}/${part}`
                })
        }

        // try {
        //     // document.location.href fills in missing pieces for url (protocol, origin, etc.)
        //     // this.#url = new URL(url, document.location.href)
        this.#url = url
        // } catch (error) {
        //     if (!(error instanceof TypeError))
        //         console.warn(error.message || error)
        //     return
        // }
    }
    /**
     * @param {string|URL} src
     * @see {@link AmplfrItem.url}
     */
    set src(src) {
        this.url(src)
    }

    /**
     * Tests if text is a valid AmplfrID
     * @param {string} text     The text to check if it matches
     * @see {@link AmplfrID}
     * @returns boolean         True if it mathes.
     */
    static isValidID(text) {
        // return typeof text == "string" && /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{22}$/.test(text)
        return typeof text == "string"
            && /^\/?[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{22}$/.test(text)
    }
    /**
     * Tests if text is a valid AmplfrID
     * @param {string} text     The text to check if it matches
     * @see {@link AmplfrID}
     * @returns boolean         True if it mathes.
     */
    static isValidIDTitle(text) {
        // return typeof text == "string" && /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{22}$/.test(text)
        return typeof text == "string"
            && /^\/?[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{22}\/?[-a-zA-Z0-9_.!~*'();/?:@&=+$,#]*$/.test(text)
    }

    /**
     * Called when the object is appended to the DOM, using src attribute or data-* attributes to populate the object.
     * @see {@link this.url}
     */
    async connectedCallback() {
        // call these first to get a jump start on them loading before they're needed
        this.#renderResources();
        this.#renderResourceMetadata()

        let url = this.url || this.getAttribute("src")
        if (!!url) {
            this.url = url
            await this.#fetch()
        }
        if (Object.keys(this.dataset).length > 0) {
            const dataset = this.dataset
            if (!!this.url)
                dataset.src = this.url
            this.#extract(dataset)
        }

        let render = this.getAttribute("render")
        if (!!render) {
            // render = render
            // render = render.split(/[\s,|]/)
            this.render = render
        }

        // this.shadow.appendChild(this.#dom);
        // this.appendChild(this.#dom);
        this.classList.add("item");

        // if this.#data isn't ready yet, wait until "populated" event fires
        if (this.#data === true)
            this.addEventListener("populated", (ev) => { this.#render() }, { once: true })
        else
            this.#render()  // this.#data is ready, so go
    }
    set render(elements) {
        if (!elements) return
        if (!Array.isArray(elements))
            // this.#listToRender = [elements]
            this.#listToRender = elements.split(/[\s,|]/)
        else
            this.#listToRender = elements

    }

    #parseURL = (url) => {
        let urlObj = null;

        try {
            urlObj = new URL(url, document.location.origin);
        } catch (error) {
            console.warn(error.message || error);
        }

        return urlObj;
    };
    /**
     * @emits "rendered" Indicates that this has been rendered
     */
    #render() {
        this.#renderElement()

        // order (probably?) does matter
        // this.renderArtwork();
        // this.renderTitle();
        // // this.renderTimeline();
        // this.renderArtists();
        // this.renderAlbum()
        // // this.#renderIcons()
        // // this.#renderTime();
        // // this.#renderLogo();
        this.#listToRender.forEach(fn => {
            fn = fn.charAt(0).toUpperCase() + fn.slice(1)
            if (!fn.startsWith("render")) fn = `render${fn}`

            this[fn]()
        })

        if (this.childNodes.length == 0)
            this.innerText = title;

        this.dispatchEvent(
            new Event("rendered", {
                bubbles: false,
            })
        );
    }
    #renderElement = () => {
        // const { id, title, duration } = this.#data;
        const id = this.id
        const title = this.title
        const duration = this.duration
        // const url = this.#parseURL(
        //     this.#data.url || this.#data.src || `//amplfr.com/${id}`
        // );
        const url = this.#parseURL(
            this.url || this.src || `//amplfr.com/${id}`
        );
        const hostname = url.hostname;
        const domain = url.hostname
            .toLowerCase()
            .replace(/^www\.|^m\.|\.com/g, "");

        let src = `//${hostname}/${id}`;
        if (!!title && hostname == "amplfr.com")
            src += `/${encodeURIComponent(title)}`;

        const attributes = {
            // id: `${domain}-${id}`,
            src,
            title,
        }
        const dataset = {
            id: `${domain}-${id}`,
            duration,
            time: Number(duration || 0).toMMSS(),
        }

        // let artists = this.#data.artists || [];
        let artists = this.artists || [];
        // if (!!this.#data.artist) artists.unshift(this.#data.artist);
        // if (artists.length >= 4)
        //     this.#data.artists = artists = [...artists.slice(0, 5), "..."];
        dataset.artists =
            artists.map((artist) => artist.name).join(", ") || artist?.name;
        dataset.artistids = artists.map(
            (artist) => `artist-${artist.id}`
        );

        // let albums = this.#data.albums || [];
        let albums = this.albums || [];
        // if (!!this.#data.album) albums.unshift(this.#data.album);
        // if (albums.length >= 4)
        //     this.#data.albums = albums = [...albums.slice(0, 5), "..."];
        dataset.albums = albums
            .map((album) => album?.name || album?.title || album)
            .join(", ");
        dataset.albumids = albums.map((album) => `album-${album.id}`);

        // set attributes and dataset attributes
        Object.entries(attributes).forEach(([k, v]) => {
            if (!!v) this.setAttribute(k, v);
        });
        Object.entries(dataset).forEach(([k, v]) => {
            if (!!v) this.setAttribute(`data-${k}`, v);
        });
    };

    /**
     * Renders the Album object, based on this.#data.album
     * @private
     */
    renderAlbum() {
        if (!this.#data) return

        const album = this.#data.album
        if (!album) return;
        if (!!this.querySelector(`.album[data-id="album/${album?.id}"]`)) return;

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

        this.appendChild(albumE);
    }
    /**
     * Renders the Artist objects, based on this.#data.artists
     * @private
     */
    renderArtists() {
        if (!this.#data) return

        // create a child element for each Artist, populate it, and append it to e
        // const artists = this.#data.artists
        const artists = this.artists
        if (artists && Array.isArray(artists) && artists.length > 0)
            artists.forEach(artist => this.renderArtist(artist))
        else if (!!this.#data.artist)
            this.renderArtist(this.#data.artist)
    }
    /**
     * Renders each Artist object
     * @param AmplfrArtist  artist
     * @private
     */
    renderArtist(artist) {
        // if (!artist) return;
        if (!artist) {
            artist = this.artists
            if (Array.isArray(artist)) artist = artist[0]
        }
        if (!!this.querySelector(`.artist[data-id="artist/${artist?.id}"]`)) return;

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

        this.appendChild(artistE);
    }
    /**
     * Renders the artwork image, based on this.id or this.#data.album.id
     * @private
     */
    renderArtwork() {
        // skip the rest if artwork isn't wanted, or this has already been run
        if (!!this.querySelector('.artwork') || this.#data?.artwork == false)
            return;


        // let id = (this.#data?.album?.id || `item/${this.#data?.id}`)
        // let id = (this.#data?.album?.id.split("/")[1] || `item/${this.#data?.id.split("/")[0]}`)
        // let artwork = this.#data?.artwork
        // if (!artwork)
        //     artwork = `/albumart/${id}.jpg`
        // let artwork = this.#data?.artwork || `/albumart/${id}.jpg`
        let artwork = this.#data?.artwork
            || (!!this.#data?.album?.id ? `/albumart/${this.#data?.album?.id?.split("/")[1] || this.#data?.album?.id}.jpg` : null)
            || (!!this.#data?.id ? `/albumart/item/${this.#data?.id?.split("/")[0]}.jpg` : null)

        let artworkE = new Image();
        artworkE.classList.add("artwork");
        artworkE.crossOrigin = 'Anonymous';  // needed to prevent CORS warnings

        if (!artwork || artwork.indexOf("undefined") > -1)
            artworkE.src = blankImage
        else
            artworkE.src = artwork;

        // if the artworkE has an error (probably got an HTTP404), use blankImage
        // artworkE.addEventListener("error", (x) => {
        //     x.currentTarget.src = blankImage
        // }, { once: true })
        artworkE.addEventListener("load", (x) => {
            if (!x.target.src.startsWith("data:"))
                decorateWithImageColor(artworkE)
                    .catch(error => {
                        if (!(error instanceof ReferenceError))
                            console.warn(error.message || error)
                    })
        }, { once: true })
        // }
        artworkE.alt = this.title;

        // add artworkE, but make sure its the first child of this
        return this.insertAdjacentElement('afterbegin', artworkE);
    }
    /**
     * Renders the logo
     * @private
     */
    #renderLogo() {
        // skip the rest if artwork isn't wanted, or this has already been run
        if (!!this.querySelector('.logo'))
            return;

        const logoE = document.createElement("a");
        logoE.classList.add("logo");
        logoE.setAttribute("href", "//amplfr.com");
        logoE.setAttribute("title", "Amplfr.com");

        // SVG and Path elements need to use createElementNS() to include Namespace
        // see https://stackoverflow.com/a/10546700
        const NS = "http://www.w3.org/2000/svg";
        const logoSVG = document.createElementNS(NS, "svg");
        const logoPath = document.createElementNS(NS, "path");

        logoPath.setAttribute("id", "logoA")
        logoPath.setAttribute(
            "d",
            "M 47.00,62.00 C 47.00,62.00 64.95,15.00 64.95,15.00 70.25,0.84 69.60,0.06 78.00,0.00 78.00,0.00 91.00,0.00 91.00,0.00 92.69,0.03 94.87,-0.07 96.30,0.99 97.85,2.14 99.36,6.16 100.15,8.00 100.15,8.00 107.85,27.00 107.85,27.00 107.85,27.00 132.42,87.00 132.42,87.00 135.50,94.33 144.84,115.57 146.00,122.00 146.00,122.00 125.00,109.60 125.00,109.60 125.00,109.60 113.84,101.68 113.84,101.68 113.84,101.68 104.81,79.00 104.81,79.00 104.81,79.00 91.69,44.00 91.69,44.00 91.69,44.00 83.00,19.00 83.00,19.00 83.00,19.00 76.98,42.00 76.98,42.00 76.98,42.00 66.00,73.00 66.00,73.00 66.00,73.00 47.00,62.00 47.00,62.00 Z M 41.00,69.00 C 41.00,69.00 69.00,85.40 69.00,85.40 69.00,85.40 111.00,110.81 111.00,110.81 111.00,110.81 138.00,127.00 138.00,127.00 138.00,127.00 138.00,129.00 138.00,129.00 138.00,129.00 72.00,169.20 72.00,169.20 72.00,169.20 41.00,187.00 41.00,187.00 41.00,187.00 41.00,69.00 41.00,69.00 Z M 31.00,103.00 C 32.82,107.60 32.00,121.34 32.00,127.00 32.00,127.00 32.00,159.00 32.00,159.00 31.98,171.17 27.55,175.11 25.00,186.00 25.00,186.00 0.00,186.00 0.00,186.00 0.00,186.00 10.80,156.00 10.80,156.00 10.80,156.00 31.00,103.00 31.00,103.00 Z M 130.00,144.00 C 130.00,144.00 151.00,132.00 151.00,132.00 151.00,132.00 173.00,186.00 173.00,186.00 173.00,186.00 153.00,186.00 153.00,186.00 153.00,186.00 145.81,184.40 145.81,184.40 145.81,184.40 140.32,172.00 140.32,172.00 140.32,172.00 130.00,144.00 130.00,144.00 Z"
        );
        logoSVG.setAttribute("viewBox", "0 0 173 187");
        logoSVG.appendChild(logoPath);

        logoE.appendChild(logoSVG);

        if (this._options?.logomplfr != false) {
            const logoWideSVG = document.createElementNS(NS, "svg");
            const logoWidePath = document.createElementNS(NS, "path");

            logoWidePath.setAttribute("id", "logomplfr")
            logoWidePath.setAttribute(
                "d",
                "M426 37C426 32 426.4 26.9 427.8 22 428.7 18.6 430.1 15.9 432.1 13 439.6 2.2 452.7 0 465 0 465 0 486 2 486 2 486 2 483.6 16 483.6 16 483.3 17.8 483 20.8 481.4 22 479.1 23.7 473.8 22.3 471 22 465.3 21.7 458.3 22.9 454.3 27.2 448.5 33.3 450 46.9 450 55 450 55 476 55 476 55 476 55 476 73 476 73 476 73 450 73 450 73 450 73 450 191 450 191 450 191 426 191 426 191 426 191 426 73 426 73 426 73 406 73 406 73 406 73 406 55 406 55 406 55 426 55 426 55 426 55 426 37 426 37ZM386 3C386 3 386 191 386 191 386 191 362 191 362 191 362 191 362 3 362 3 362 3 386 3 386 3ZM53 52.2C53 52.2 67 52.2 67 52.2 73.6 52.1 80.3 53.8 86 57.2 94.8 62.4 95.6 66.5 101 74 107.2 62.5 120.2 54.2 133 52.2 133 52.2 146 52.2 146 52.2 160 52.2 172.5 58 179 71 185.3 83.6 184 100.2 184 114 184 114 184 191 184 191 184 191 160 191 160 191 160 191 160 102 160 102 160 94.4 159.2 85.9 153.8 80.1 140.5 65.6 116.4 74.1 108.4 90 103 100.7 104 115.3 104 127 104 127 104 191 104 191 104 191 80 191 80 191 80 191 80 102 80 102 80 94.7 78.8 85.7 73.8 80 61.6 66.2 37.5 73.1 28.8 90 23.2 101 24 115.9 24 128 24 128 24 191 24 191 24 191 0 191 0 191 0 191 0 55 0 55 0 55 21 55 21 55 21 55 22 72 22 72 27.8 61.3 41.1 53.8 53 52.2ZM305 57.9C310.4 60.9 316.7 66.2 320.5 71 339.8 95.5 340.6 142 323.9 168 310.4 189.1 280.6 200.9 257 190.1 250.2 187 246 183.3 241 178 241 178 241 243 241 243 241 243 217 243 217 243 217 243 217 55 217 55 217 55 239 55 239 55 239 55 240 71 240 71 250.4 49.1 286.1 47.6 305 57.9ZM552 52.7C555.6 53.4 565.2 56.4 566.2 60.2 566.7 62.1 565.3 65.2 564.7 67 564.7 67 559 81 559 81 552.8 79.2 546.7 75.5 540 76.5 522 79.1 517 99.7 517 115 517 115 517 191 517 191 517 191 493 191 493 191 493 191 493 55 493 55 493 55 514 55 514 55 514 55 515 73 515 73 522.3 56.8 534.1 48.9 552 52.7ZM241.7 146C246.2 161.1 256.2 173.3 273 174 288.3 174.6 300.9 164.9 306.6 151 308.6 145.9 309.4 141.4 310.3 136 313.9 113.8 309.5 77.6 283 71.4 279.4 70.7 273.7 70.9 270 71.4 239.6 78.2 234.3 120.9 241.7 146Z"
            );
            logoWideSVG.appendChild(logoWidePath);

            // logoWideSVG.classList.add("logoWide");
            logoWideSVG.setAttribute("viewBox", "0 0 567 243");
            logoWideSVG.classList.add("logomplfr");
            logoE.appendChild(logoWideSVG);
        }

        root.appendChild(logoE);

        // add artworkE, but make sure its the first child of this
        return this.insertAdjacentElement('afterbegin', artworkE);
    }
    renderTimeline() {
        // skip the rest if this has already been run
        if (!!this.querySelector('.timeline-container'))
            return;
        if (!this.querySelector('.title')) return;  // don't render .timeline if there's no title

        // add the timeline container element (to this.#dom)
        const timelineContainerE = document.createElement("div");
        timelineContainerE.classList.add("timeline-container");
        // this._dom.progress = timelineContainerE; // save timelineContainerE for easy access later
        this.progress = timelineContainerE; // save timelineContainerE for easy access later

        // add the timeline element (to timeline container element)
        const timelineE = document.createElement("div");
        timelineE.classList.add("timeline");
        timelineContainerE.appendChild(timelineE);

        // add the thumb-indicator element (to timeline element)
        const thumb = document.createElement("div");
        thumb.classList.add("thumb-indicator");
        timelineE.appendChild(thumb);

        // append to (what should be) the end of the this element
        this.insertAdjacentElement('beforeend', timelineContainerE);
    }
    /**
     * Renders the title object.
     * @private
     * @see {@link title}
     */
    renderTitle() {
        if (!this.title) return;
        if (!!this.querySelector('.title')) return;

        let titleE;
        if (!!this.href) {
            titleE = document.createElement("a");
            titleE.setAttribute("href", this.href);
        } else titleE = document.createElement("span");
        titleE.classList.add("title");

        titleE.textContent = this.title;
        titleE.title = this.title;

        this.appendChild(titleE);
    }

    #renderResources() {
        // add the following resource elements only if each isn't already present
        let resources = {
            "/css/item.css": "link",
            "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@48,400,1,0": "link",
            "https://cdnjs.cloudflare.com/ajax/libs/color-thief/2.4.0/color-thief.umd.js": "script",
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
}
const decorateWithImageColor = async (img, palettes) => {
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

class AmplfrAudio extends HTMLElement {
    // #idToSrc = (id) => `/api/${id.split("/")[0]}.files`
    #srcPrefix = '/api'
    #idToSrc = (id) => `${this.#srcPrefix}/${id.split("/")[0]}.files`
    #mediaURLPrefix = this.#srcPrefix
    #media
    #metadata
    #loopCounter = false
    #skipUpdateTime = false
    #skipUpdateTimeDelay = 450

    /**
     * 
     * @param {String|AmplfrMetadata|null} src URL (if string), AmplfrMetadata Object
     *      If src is a URL, then URL will be queried to fetch AmplfrMetadata data.
     *      If src is a JSON string, then will be JSON.parse()ed to create AmplfrMetadata object.
     *      If src is not set, then must call {@link url()} to set URL.
     */
    constructor(src) {
        super()

        // setup the AmplfrItem object
        if (src instanceof AmplfrItem)
            this.#metadata = src
        else
            this.#metadata = new AmplfrItem(src)

        this.#metadata.srcObject = true     // let this.#metadata know that this wants srcObject (if available)
        // from https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#the_value_of_this_within_the_handler
        // this.#metadata.addEventListener("fetched", (ev) => {
        //     const detail = ev.detail
        //     this.src(ev.detail)
        // }, { once: true })
        this.#metadata.addEventListener("populated", () => { this.#onMetadataPopulated() }, { once: true })
        this.#metadata.addEventListener("rendered", () => { this.#render() }, { once: true })

        if (!!src)
            this.#metadata.url = src

        this.#media = new Audio()
        this.#media.autoplay = false; // wait to play
        this.#media.controls = false; // no native controls
        this.#media.preload = "metadata";
        this.#media.setAttribute('crossorigin', 'anonymous')

        this.#setupMediaEvents()
    }

    async #onMetadataPopulated() {
        let id = this.id
        let url = this.url

        if (!!id && !!url)
            try {
                url = new URL(this.#idToSrc(id), url)
            } catch (error) {
                url = this.url
            }

        if (!!this.#metadata.srcObject && this.#metadata.srcObject !== true) {
            this.src = this.#metadata?.srcObject
            delete this.#metadata.srcObject
        } else
            this.src = await this.#checkSrc(url)

        this.#metadata.populated = true

        if (this.#metadata.querySelector(".title"))
            this.#render()
    }
    #setupMediaEvents() {
        const that = this;
        const media = this.#media

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
        media.addEventListener("stalled", (e) => this.#warn(e.type));
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

            if (!!media.duration)
                this.#renderTime()

            that.#updateTime();
        });
        media.addEventListener("loadedmetadata", (e) => {
            this.#log(e.type)
            that.#updateTime();

            // the fetch() below won't work for a blob: "URL" so bail
            if (media.currentSrc.toLowerCase().startsWith("blob:")) return

            // attempt a HEAD request for the media file to get its size
            // since some of media.currentSrc has been downloaded to get here, this fetch() shouldn't have issues
            // this is a best effort attempt, hence the .then()
            fetch(media.currentSrc, { method: "HEAD" })
                .then((res) => {
                    if (res.ok) {
                        // use either the Content-Range (total) or Content-Length header values
                        let ContentRange = res.headers.get("Content-Range")?.split("/")[1]
                        let ContentLength = res.headers.get("Content-Length")

                        that.#media.bytes = parseInt(ContentRange ?? ContentLength)

                        this.#progressUpdate(e)
                    }
                })
        });
        media.addEventListener("loadeddata", (e) => {
            that.#progressUpdate(e)
        });
        media.addEventListener("progress", (e) => {
            // update what percentage (of time) has been downloaded thus far
            if (!!that.#media.buffered.length) {
                // is this completely loaded?
                if (that.loaded >= 1) {
                    // dispatch a "loaded" event
                    that.dispatchEvent(
                        new Event("loaded", {
                            bubbles: true,
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
        media.addEventListener("ratechange", (e) => this.#log(e.type));
        media.addEventListener("resize", (e) => this.#log(e.type));
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
            if (e.currentTarget != media)
                return;
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
        });
        // media.addEventListener("emptied", (e) => this.#log(e.type));
        // media.addEventListener("volumechange", (e) => this.#log(e.type));

        // setup any event listeners User already submitted
        // if (!!this.listeners) {
        //     Object.entries(this.listeners).forEach(
        //         ([event, { listener, options }]) =>
        //             media.addEventListener(event, listener, options)
        //     );

        //     delete this.listeners   // no further need
        // }
    }
    #updateButton(text, title) {
        if (!this.button)
            this.#renderButton()

        this.button.innerHTML = text;
        this.button.title = title;
    };
    #updateTime(justDuration = true) {
        if (this.#skipUpdateTime) return    // throttle calls

        if (!this || !this.#media) return;  // no media, nothing else to do here

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
        // if (!!this.progress)
        //     this.progress.style.setProperty("--progress-position", percent);
        this.style.setProperty("--progress-position", percent);

        this.#skipUpdateTime = true
        const that = this
        setTimeout(function () {
            that.#skipUpdateTime = false
        }, that.#skipUpdateTimeDelay)
    }

    /**
     * Checks if given src points to a media file or a JSON file
     * @async
     */
    async #checkSrc(src) {
        let sources = src

        /**
         * @todo MAYBE use a list of known bits from src before calling fetch(src) below
         *  - is src's domain known?
         */
        let contentType
        try {
            const response = await fetch(src?.href || src, {
                cache: "force-cache",
                headers: {
                    "Accept": "audio/*; 1.0, video/*; q=0.8, application/json; q=0.5, */*; q=0.1"
                }
            })
            // const requestHeaders = new Headers({
            //     "Accept": "audio/*; 1.0, video/*; q=0.8, application/json; q=0.5, */*; q=0.1"
            // })
            // const request = new Request(src?.href || src, {
            //     // cache: "force-cache",
            //     headers: requestHeaders,
            // })
            // const response = await fetch(request)
            if (!response.ok)
                throw new Error(`${response.status} ${response.statusText}: ${src}`);

            // console.debug(`${response.status} - ${src?.href || src}`)

            const headers = response.headers
            // for (let [header, value] of headers) {
            //     header = header
            //         .split("-")
            //         .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            //         .join("-")
            //     console.log(`${(header)}=${value}`);
            // }

            contentType = headers.get('Content-Type')
            if (contentType == "application/json")
                sources = await response.json()
            else if (!!contentType && (contentType.startsWith("audio/") || contentType.startsWith("video/"))) {
                sources = {
                    src,
                    type: contentType,
                }

                if (headers.get("Content-Length"))
                    sources.bytes = headers.get("Content-Length")
            }
        } catch (error) {
            console.warn(error);
            return
        }

        return sources
    }

    /**
     * Sets src.
     * @param {AmplfrSource[]|AmplfrSource|URL|string} sources   The Amplfr
     * @see {@link AmplfrItem#src}
     */
    set src(sources) {
        if (!!this.#media && !!this.#media.src)
            return

        // set the source(s) for this.#media
        if (!Array.isArray(sources)) {
            this.#media.src = sources.src || sources
            return
        }

        const map = {
            probably: 1,
            maybe: 2,
            "": 3, // no chance
        }

        sources
            .filter(source => this.#media.canPlayType(source.mime || source) !== "") // skip anything client can't play
            .map(source => {
                // set the correct src
                source.src = `${this.#mediaURLPrefix}/${source.filename}`
                return source;
            })
            .sort((a, b) => {
                // prefer media files that are playable by client
                if (map[a] < map[b]) return -1
                else if (map[a] > map[b]) return 1
                else return 0;
            })
            .forEach(source => {
                // append a source element for each URL/MIME-type
                const sourceE = document.createElement("source");
                sourceE.src = source.src || source;
                if (!!source.mime)
                    sourceE.type = source.mime;

                this.#media.appendChild(sourceE); // append to the media element
            })
    }

    async connectedCallback() {
        const parentSrc = this.getAttribute("src")
        if (!!parentSrc)
            this.#metadata.setAttribute("src", parentSrc)

        // pass any this.dataset attributes to this.#metadata
        if (Object.keys(this.dataset).length > 0)
            Object.entries(this.dataset).forEach(([k, v]) => {
                this.#metadata.setAttribute(`data-${k}`, v)
            })

        await this.#metadata.connectedCallback()

        // // move this.#metadata's children to this
        // this.classList.add("item")
        // const innerChild = this.firstChild
        // while (innerChild.childNodes.length > 0)
        //     this.appendChild(innerChild.firstChild)

        // this.removeChild(this.#metadata)    // no longer need the AmplfrItem HTMLElement

        this.classList.add("item")
    }
    #render() {
        this.appendChild(this.#metadata)

        // move this.#metadata's children to this
        const innerChild = this.firstChild
        while (innerChild.childNodes.length > 0)
            this.appendChild(innerChild.firstChild)

        // show the time if available
        if (!!this.#metadata.duration)
            this.#renderTime()

        this.removeChild(this.#metadata)    // no longer need the AmplfrItem HTMLElement
    }
    #renderButton() {
        // skip if this already exists
        if (!!this.querySelector('button')) return;

        // add the control button
        const buttonE = document.createElement("button");
        buttonE.classList.add("material-symbols-outlined");
        buttonE.classList.add("play");

        const that = this
        buttonE.addEventListener("click", function (e) {
            e.preventDefault();
            that.play();
        });
        buttonE.addEventListener("touchend", function (e) {
            e.preventDefault();
            that.play();
        });

        // save the controls for easy access later
        this.button = buttonE

        // add element, but make sure its the first child of this.#dom
        this.insertAdjacentElement('afterbegin', buttonE);
    }
    #renderTime() {
        if (!!this.querySelector('.time')) return;
        const timeE = document.createElement("span");
        timeE.classList.add("time");

        if (this.duration > 0)
            timeE.innerText = Number(this.duration).toMMSS()

        // const timelineE = this.querySelector(".timeline-container")
        // if (!!timelineE)
        //     this.insertBefore(timeE, timelineE)
        // else
        this.appendChild(timeE);

        this.time = timeE; // save timeE for easy access later
    }


    // Metadata get'er/set'er methods
    /**
     * Gets url.
     * @see {@link AmplfrItem#url}
     */
    get url() { return this.#metadata.url }
    /**
     * Gets ID.
     * @see {@link AmplfrItem#id}
     */
    get id() { return this.#metadata.id }
    /**
     * Gets title.
     * @see {@link AmplfrItem#title}
     */
    get title() { return this.#metadata.title }
    /**
     * Gets album.
     * @see {@link AmplfrItem#album}
     */
    get album() { return this.#metadata.album }
    /**
     * Gets artists.
     * @see {@link AmplfrItem#artists}
     */
    get artists() { return this.#metadata.artists }
    /**
     * Gets artwork.
     * @see {@link AmplfrItem#artwork}
     */
    get artwork() { return this.#metadata.artwork }
    /**
     * Sets url.
     * @see {@link AmplfrItem#url}
     */
    set url(url) {
        // this.#metadata.url(url) // kind of like calling super.url(url)
        this.#metadata.url = url    // kind of like calling super.url(url)
    }

    // Media get'er/set'er methods
    get buffered() { return this.#media.buffered }
    get currentSrc() { return this.#media.currentSrc }
    get currentTime() { return this.#media.currentTime }
    /**
     * Specifies the current playback time in seconds.
     * Changing the value of currentTime seeks the media to the new time.
     * @param {double|number} seconds 
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/currentTime|currentTime}
     */
    set currentTime(seconds) { return this.#media.currentTime = seconds }
    get duration() { return this.#media.duration }
    get ended() { return this.#media.ended }
    get error() { return this.#media.error }
    set loop(v = !this.loop) {
        this.#media.loop = !!v;
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
            this.#media.loop = false;
            this.removeEventListener("seeked", (e) => { this.#decrementLoops() });
        }
    };
    muted(v) { this.#media.muted(v) }
    get networkState() { return this.#media.networkState }
    get paused() { return this.#media.paused }
    get played() { return this.#media.played }
    playbackRate(v) { this.#media.playbackRate(v) }
    get readyState() { return this.#media.readyState }
    get seekable() { return this.#media.seekable }
    get seeking() { return this.#media.seeking }
    get src() {
        return this.#media.src
    }
    get srcObject() {
        return this.#media.srcObject
    }
    volume(v) { this.#media.volume(v) }

    // Media methods
    /**
     * @param {string} type 
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/canPlayType|canPlayType}
     */
    canPlayType(type) { this.#media.canPlayType(type) }
    /**
     * Quickly seeks to the new time with precision tradeoff.
     * @param {double|number} seconds 
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/fastSeek|fastSeek}
     */
    fastSeek(seconds) { this.#media.fastSeek(seconds) }
    load() { this.#media.load() }
    pause() { this.#media.pause() }
    play() {
        // pause if not already
        if (!this.paused) {
            this.pause();
            return;
        }

        // restart from the beginning if ended
        if (!!this.ended)
            this.fastSeek(0);

        this.#media.play()
    }

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

    // helper methods
    #log(msg) {
        console.log(`${this.#media?.currentSrc || this.url} - ${msg}`);
    }
    #warn(msg) {
        console.warn(`${this.#media?.currentSrc || this.sourceURL} - ${msg}`);
        this.#updateButton("report", `Warning: ${msg}`);
    }
    #progressUpdate(e) {
        Number.prototype.toHumanBytes = function () {
            if (Number.isNaN(this.valueOf())) return "";

            // based on https://gist.github.com/zentala/1e6f72438796d74531803cc3833c039c
            if (this == 0) return "0B";
            const k = 1024;
            const dm = 2;
            const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
            const i = Math.floor(Math.log(this) / Math.log(k));

            // return parseFloat((this / Math.pow(k, i)).toFixed(dm)) + sizes[i];
            return (this / Math.pow(k, i)).toFixed(dm) + sizes[i];
        };

        const bytesLoaded = (!this.#media.bytes) ? "" : Math.round(this.loaded * this.#media.bytes).toHumanBytes() + " "

        // this.#log(`${e.type} ${Math.round(this.loaded * this.duration)} of ${Number(this.duration).toFixed(2)}s (${Number(this.loaded * 100).toFixed(2)}%)`);
        this.#log(`${e.type} ${Math.round(this.loaded * this.duration)}s ${bytesLoaded}(${Number(this.loaded * 100).toFixed(2)}%)`);
    }
}

/**
 * 
 * TODO implement [iterator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Iterators_and_generators#iterators)
 * TODO implement this.loop
 * TODO drop the this.#media object from an AmplfrItem that has been played and !this.loop
 * 
 * 
 * TODO pull out the 
 */
class AmplfrCollection extends HTMLElement {
    // #domain = `${document.location.protocol}//amplfr.com`
    #domain = `${document.location.protocol}//${document.location.host}` // "localhost:8080"
    #idToURL = (id) => `${this.#domain}/${id}`  // `https://${this.#domain}/${id}`
    #idToAPI = (id) => `${this.#domain}/api/${id.split("/", 2).join("/")}.json` // `https://${this.#domain}/api/${id.split("/", 2).join("/")}.json`
    #url;   // the provided/set URL
    #id;    // the ID derived from the URL or set after metadata fetched
    #data;  // holds the returned #fetch()ed object
    #items
    #loop = false
    #observerObj
    #controls


    constructor(src) {
        // super(src)
        super()

        if (!!this.#observer) {
            // watch this for any added/removed child nodes
            this.#observerObj = new MutationObserver(this.#observer)
            this.#observerObj.observe(this, {
                childList: true,
            })
        }

        // if (!!src)
        //     if (typeof src == "string")
        //         this.setAttribute("src", src)
        if (typeof src == "string" && src.length > 0) {
            this.url = src
            if (!this.url) {
                try {
                    src = JSON.parse(src)
                } catch (error) {
                    return
                }
            }
        }
        else if (!!src && Object.keys(src).length > 0)
            return this.#extract(src)

        if (!!this.url)
            this.#fetch()
    }


    #select(item) {
        const wasSelected = this.selected
        const detail = {}

        this.#deselectOthers()
        item.classList.add("active")
        // item.setAttribute("id", "playing")

        if (!!wasSelected) {
            detail.wasSelected = wasSelected
            detail.nowSelected = this.selected

            this.dispatchEvent(
                new Event("changed", {
                    bubbles: true,
                    detail,
                })
            );
        }
    }
    #deselectOthers() {
        this.querySelectorAll("amplfr-item.active").forEach(item => item.classList.remove("active"))
        // if (!!this.querySelector("#playing"))
        //     item.setAttribute("id", "playing").removeAttribute("id")
    }
    /**
     * Sets the src URL to use if not already set.
     * @param {string|AmplfrID|URL} src
     */
    set src(url) {
        if (!!this.url) return  // don't set if already set

        // if url is ValidID, then convert the ID to a URL and assign to url 
        // if (!!this.isValidID(url)) {
        if (!!AmplfrCollection.isValidID(url)) {
            if (url.startsWith("/"))
                url = url.substring(1)   // drop a leading "/"
            this.#id = url  // save the ID
            url = this.#idToURL(url)    // convert the ID to a URL and save it
        }

        try {
            // document.location.href fills in missing pieces for url (protocol, origin, etc.)
            this.#url = new URL(url, document.location.href)

            if (!!this.#url.hash)
                this.render = url.hash
        } catch (error) {
            if (!(error instanceof TypeError))
                console.warn(error.message || error)
            return
        }
    }
    set url(url) {
        this.src = url
    }
    get src() {
        return this.#url
    }
    get url() {
        return this.#url
    }
    /**
     * Gets ID.
     * @see {@link AmplfrItem#id}
     */
    get id() { return this.#id }
    /**
     * Tests if text is a valid AmplfrCollectionID
     * @param {string} text     The text to check if it matches
     * @see {@link AmplfrCollectionID}
     * @returns boolean         True if it mathes.
     */
    static isValidID(text) {
        const acceptedPrefixes = [
            "album",
            "playlist",
            "queue",
        ]
        let prefix
        text = text.replace(/^\/api|\.json$/, "")
        if (text.charAt(0) == "/") {
            text = text.substring(1)
        }
        [prefix, text] = text.split("/")

        // const expectedPrefix = this.localName.split("-")[1]
        // if (prefix !== expectedPrefix)
        if (!acceptedPrefixes.includes(prefix))
            return false
        if (!text || text == "")
            return true

        return typeof text == "string"
            && /^\/?[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{22}\/?[-a-zA-Z0-9_.!~*'();/?:@&=+$,#]*$/.test(text)
    }
    static isCollectionURL(url) {
        let answer = false
        let pathname

        // need url to be url.pathname
        if (!(url instanceof URL))
            try {
                url = new URL(url)
            } catch (error) {

            }

        return answer
    }
    static isCollection(obj) {
        let answer = false
        let items

        if (!obj)
            return answer
        if (!!Array.isArray(obj))
            items = obj
        else if (!!obj.items && Array.isArray(obj.items))
            items = obj.items

        if (!!Array.isArray(items))
            answer = true
        // answer = items
        //     .map(item => {
        //         let url = item?.url || item
        //         return AmplfrItem.isValidIDTitle(url.replace(/^\/api|\.json$|^\//, ""))
        //     })
        //     .reduce((acc, cur) => acc && cur, true)

        return answer
    }

    #observer(mutationList) {
        const that = mutationList[0].target
        let addedItems = false
        let removedItems = false

        for (const mutation of mutationList) {
            if (mutation.type === "childList") {
                // console.debug("A child node has been added or removed.");

                // if added and not removed
                if (mutation.addedNodes.length > 0 && mutation.removedNodes.length == 0)
                    addedItems = true

                // if added and not removed
                if (mutation.removedNodes.length > 0 && mutation.addedNodes.length == 0)
                    removedItems = true
            }
        }

        if (addedItems === true)
            that.#filterItems()
        // select the first Item
        if (!!!that.selected && that.length >= 1)
            that.#select(that.item(0))

        if (addedItems === true || removedItems === true)
            that.#updateControls()
    }

    /**
     * Called when the object is appended to the DOM, using src attribute or data-* attributes to populate the object.
     * @see {@link this.url}
     */
    async connectedCallback() {
        let url = this.getAttribute("src")
        if (!!url) {
            this.url = url
            await this.#fetch()
        }
        if (Object.keys(this.dataset).length > 0) {
            const dataset = this.dataset
            if (!!this.url)
                dataset.src = this.url
            this.#extract(dataset)
        }

        // TODO should there be a check see if to then flatten this Collection's Items to its parent?
        // if (this.parent instanceof AmplfrCollection) {
        //  const outerCollection = this.parentNode
        //  
        // }

        // this.shadow.appendChild(this.#dom);
        // this.appendChild(this.#dom);
        this.classList.add("collection");

        this.#filterItems()
        this.items.forEach(item => this.#setupMediaEvents(item))
        if (this.length >= 1)
            this.#select(this.items[0])

        // should Controls be rendered?
        const doControls = this.getAttribute("controls")
        // if (!!doControls && doControls != false)
        if (false && doControls != "false")
            //     this.#renderControls()
            // if (this.hasAttribute("controls"))
            // if (this.hasAttribute("controls") && !!this.getAttribute("controls"))
            this.controls = true

        this.dispatchEvent(
            new Event("populated", {
                bubbles: true,
            })
        );
    }
    #renderControls() {
        if (!!this.#controls || this.#controls == false) return;
        const e = document.createElement("div");
        e.setAttribute("id", "controls");
        e.classList.add("controls");

        if (this.items.length == 1) e.classList.add("hidden");

        this.insertAdjacentElement("afterbegin", e); // before first child

        // collection.controls = collection.controls || {};  // e; // save for easy access later
        this.#controls = e; // save for easy access later
        this.controlsToUpdate = this.controlsToUpdate || {};

        const that = this;
        const controls = [
            {
                id: "toggleQueue",
                title: "show or hide Queue",
                text: "playlist_play",
                updateStatus: (e) => {
                    e.classList.toggle(
                        "activated",
                        this.classList.contains("minimized")
                    );
                },
                fn: () => {
                    this.classList.toggle("minimized");
                },
            },
            {
                id: "previous",
                title: "Previous",
                text: "skip_previous",
                updateStatus: (e) => {
                    e.classList.toggle("disabled", !this.previous(false));
                },
                fn: this.previous,
            },
            {
                id: "loop",
                title: "Repeat",
                text: "repeat",
                updateStatus: (e) => {
                    e.classList.toggle("activated", this.loop);
                },
                fn: () => {
                    this.loop = !this.loop;
                },
            },
            {
                id: "share",
                title: "Share",
                text: "share",
                fn: this.share,
            },
            {
                id: "shuffle",
                title: "Shuffle",
                text: "shuffle",
                fn: this.shuffle,
            },
            {
                id: "next",
                title: "Next",
                text: "skip_next",
                updateStatus: (e) => {
                    e.classList.toggle("disabled", !this.next(false));
                },
                fn: this.next,
            },
        ];
        controls.forEach((ctrl) => {
            if (!ctrl.fn) return; // skip if ctrl.fn doesn't exist

            const ce = document.createElement("button");
            ce.setAttribute("id", ctrl.id);
            ce.setAttribute("title", ctrl.title);
            ce.classList.add("material-symbols-outlined");

            if (ctrl.class) ce.classList.add(...ctrl.class);
            if (ctrl.updateStatus && typeof ctrl.updateStatus == "function") {
                ctrl.updateStatus(ce);

                this.controlsToUpdate[ctrl.id] = ctrl.updateStatus;
            }
            ce.innerText = ctrl.text;
            e.appendChild(ce);
            // collection.controls[ctrl.id] = ce

            function action(ev) {
                ev.preventDefault();
                if (ev.target.classList.contains("disabled")) return; // don't do anything if target is disabled
                // ctrl.fn.bind(that)(ev);
                ctrl.fn.bind(this)(ev);

                this.#updateControls();
                // run through all of the controls that may be affected by an outside change
                // Object.entries(this.controlsToUpdate).forEach(([id, fn]) => {
                //     // fn(collection.controls[id])
                //     fn(this.controls.children.namedItem(id));
                // });
            }
            ce.addEventListener("click", (ev) => action(ev));
            ce.addEventListener("touchend", (ev) => action(ev));
            // })
        }, this);

        this.#renderSearch()
    }
    #renderSearch() {
        if (!this.#controls || !!this.#controls?.search) return

        const e = document.createElement("input");
        e.type = "search"
        e.id = "search"
        e.placeholder = "Search songs, artists, lyrics, albums, and more"

        this.#controls.appendChild(e)
    }
    get controls() {
        return !!this.#controls
    }
    set controls(v) {
        const controlsAreRendered = !!this.controls
        if (controlsAreRendered && !!v)
            return

        if (!controlsAreRendered && !!v) {
            this.#renderControls()
        }
        else if (!!controlsAreRendered && !!!v) {
            this.#controls = null
            this.querySelector(".controls")?.remove()
        }
        this.setAttribute("controls", !!v)
    }
    #updateControls() {
        if (!this.controlsToUpdate) return
        // run through all of the controls that may be affected by an outside change
        Object.entries(this.controlsToUpdate).forEach(([id, fn]) => {
            // fn(this.controls[id])
            fn(this.controls.children.namedItem(id))
        }, this)
    }

    get selected() {
        // get what the current .active item is, or the first amplfr-item element
        // return this.querySelectorAll("amplfr-item.active")[0] || this.items[0]
        return this.querySelectorAll(".active")[0]  // || this.items[0]
    }
    #filterItems() {
        this.#items = Array.from(this.children).filter(element =>
            element instanceof AmplfrItem || element instanceof AmplfrAudio
        )
    }
    get items() {
        if (!this.#items)
            this.#filterItems()

        return this.#items
    }
    /**
     * 
     * @param {number} position the position of the Item to return
     * @returns 
     */
    item(position) {
        return this.items[position]
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

    /**
     * Returns the API URL, or just the URL
     * @private
     * @readonly
     */
    get #api() {
        let id = this.id

        if (!!id)
            return this.#idToAPI(id)

        return this.url
    }
    /**
     * Fetches metadata from URL. If URL 
     * @see {@link url} for which URL is used.
     * @async
     */
    async #fetch() {
        // if this.#data is already parsed, nothing else to do here
        if (!!this.#data) return

        const url = this.#api
        if (!url) return

        // special value indicating data is being fetched
        this.#data = true
        let json
        try {
            let contentType
            const response = await fetch(url, {
                cache: "force-cache",
                headers: {
                    "Accept": "application/json; q=1.0, text/*; q=0.8, application/mpegurl; q=0.7, application/x-mpegurl; q=0.7, audio/mpegurl; q=0.7, audio/x-mpegurl; q=0.7, */*; q=0.1"
                }
            });
            if (!response.ok)
                throw new Error(`${response.status} ${response.statusText}: ${url}`);

            const headers = response.headers
            // console.debug(`${response.status} - ${url}`)

            // for (let [header, value] of headers) {
            //     header = header
            //         .split("-")
            //         .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            //         .join("-")
            //     console.log(`${(header)}=${value}`);
            // }
            contentType = headers.get("Content-Type")

            // dispatch a "fetched" event
            this.dispatchEvent(
                new Event("fetched", {
                    bubbles: false,
                })
            );
            if (contentType == "application/json")
                json = await response.json();
            else if (contentType.endsWith("mpegurl")) {
                const text = await response.text();
                json = this.#extractM3U(text)
            }
        } catch (error) {
            console.warn(error);
        }

        if (!!json)
            this.#extract(json)

        // cleanup if necessary
        if (this.#data === true)
            this.#data = null
    }
    /**
     * Parses metadata from json and populates the Item(s) specified in json.items
     * @param {Object} json 
     * @emits "populated" Emitted once metadata is successfully populated.
     */
    #extract(json) {
        // if this.#data is already parsed, nothing else to do here
        if (!!this.#data && this.#data !== true) return

        let items
        this.#data = json   // initialize this.#data since we've got this far

        if (json?.items)
            items = json.items
        else if (Array.isArray(json))
            items = json

        // setup each item with whatever information has been given so far
        if (!!items && Array.isArray(items) && items.length > 0)
            items.forEach(item => {
                let itemE
                // itemE = new AmplfrAudio(item)
                itemE = new AmplfrItem(item)

                this.appendChild(itemE)
            }, this)

        if (!!json?.url)
            this.url = json.url

        // dispatch a "populated" event
        this.dispatchEvent(
            new Event("populated", {
                bubbles: true,
            })
        );
    }
    /**
     * Parses M3U (or M3U8) text and extracts the needed data to build the object
     * @param {URL|string} urlObj The URL used as base URL for any relative URLs. Removes any text after the last '/' for the base path.
     * @param {string} text The raw M3U (M3U8) text
     * @returns {CollectionSourceData}
     * @see {@link https://en.wikipedia.org/wiki/M3U|Wikipedia M3U}
     * @see {@link https://www.wimpyplayer.com/docs/pl.format.m3u.html|M3U Playlists}
     */
    #extractM3U(text) {
        const lines = text.split(/\n|\r\n/); // break text into separate lines
        let obj = {}

        // confirm that the first line has the required string "#EXTM3U"
        // if (!lines[0].test(/^#EXTM3U/i))
        if (!lines[0].toUpperCase().startsWith("#EXTM3U"))
            return null;
        lines.shift(); // remove the first line

        // urlObj = urlObj.toString();
        // let baseUrl = urlObj.substring(0, urlObj.lastIndexOf("/")) + "/";
        let baseUrl = this.url

        let line;
        obj.items = [];
        let item = {}
        for (let n = 0; n < lines.length; n++) {
            line = lines[n];
            // if (line.test(/^\s*$/))
            // skip any "blank" lines
            if (line.length == 0) continue;

            // based on https://en.wikipedia.org/wiki/M3U#File_format
            if (line.startsWith("#")) {
                if (line.toUpperCase().startsWith("#EXTINF:")) {
                    let [seconds, title] = line.substring(8).split(",")

                    if (!!seconds) {
                        seconds = Number.parseFloat(seconds)
                        if (seconds > 0)
                            item.duration = seconds
                    }
                    if (!!title && title.length > 0)
                        item.title = title
                }
                else if (line.toUpperCase().startsWith("#PLAYLIST:")) {    // playlist title
                    let [prefix, title] = line.split(":")
                    obj.title = title.trim()
                }
                else if (line.toUpperCase().startsWith("#EXTART:")) {      // entry artist
                    let [prefix, artists] = line.split(":")
                    item.artists = artists.trim()
                }
                else if (line.toUpperCase().startsWith("#EXTIMG:")) {      // entry artwork
                    // save the artist name(s)
                    let [prefix, artwork] = line.split(":")
                    item.artwork = artwork.trim()

                    // ensure obj.artwork is an absolute URL
                    // if (!obj.artwork.indexOf("://"))
                    try {
                        obj.artwork = new URL(obj.artwork, baseUrl);
                    } catch (error) { }
                }
            }
            else {      // individual item
                // #EXTINF:123,Artist Name – Track Title␤
                // artist - title.mp3;
                // if (!line.indexOf("://"))
                try {
                    // ensure location is an absolute URL
                    line = new URL(line, baseUrl);
                } catch (error) { }

                if (!!item && Object.keys(item).length > 0)
                    // item.url = line
                    item.url = line.href || line
                else
                    item = line.href || line

                // append this item to obj.items
                obj.items.push(item);

                item = {}   // setup new item object
            }
        }

        return obj;
    }

    #setupMediaEvents(item) {
        const collection = this
        // const previousItem = collection.previous(false) // save it since we're going to use it a few times here
        const previousItem = item.previousElementSibling // save it since we're going to use it a few times here

        // if there's another like this, be polite
        if (!!previousItem) {
            previousItem.addEventListener("loadedmetadata", (ev) => { item.load() })
            previousItem.addEventListener("ended", (ev) => {
                collection.#select(item)
                item.play()
            })
        }
        else
            // this is the only or first
            item.load()
    }

    previous(changeSelected = true) {
        // loop back from this until we run out of elements or find another like this
        // let element = this.selected?.previousElementSibling
        let element = this.selected
        element = element?.previousElementSibling || element

        while (element != null) {
            if (element instanceof AmplfrItem)
                break
            else if (element instanceof AmplfrAudio)
                break

            element = element.previousElementSibling
        }

        // if element is still null and loop is enabled
        if (!element && !!this.#loop)
            // set the first AmplfrItem (or will still be null)
            element = this.querySelector("amplfr-item,amplfr-audio")
        if (!!changeSelected && !!element)
            this.#select(element)

        return element
    }
    next(changeSelected = true) {
        // loop back from this until we run out of elements or find another like this
        // let element = this.selected?.nextElementSibling
        let element = this.selected
        element = element?.nextElementSibling || element

        while (element != null) {
            if (element instanceof AmplfrItem)
                break
            else if (element instanceof AmplfrAudio)
                break

            element = element.nextElementSibling
        }

        // if element is still null and loop is enabled
        if (!element && !!this.#loop)
            // set the first AmplfrItem
            element = this.querySelector("amplfr-item,amplfr-audio")
        if (!!changeSelected && !!element)
            this.#select(element)

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
    get ended() { return this.selected.ended }

    // functions, setters and getters that interact with this.active
    /**
     * 
     * @param {null|Number|String} (item) Null to play active AmplfrItem, or index (as number) or ID/Title (as string) of AmplfrItem to play.
     */
    play(item = null) {
        let selected = this.selected

        if (typeof item == "number") {
            selected = this.items.item(item)

            this.#deselectOthers()
            this.#select(selected)
        }
        else if (typeof item == "string") {
            selected = this.items.namedItem(item)

            this.#deselectOthers()
            this.#select(selected)
        }

        this.selected.play()
    }
    pause() { this.selected.pause() }
    stop() { this.selected.stop() }
    fastSeek(s) { this.selected.fastSeek(s) }
    seekTo(s, precise) { this.selected.seekTo(s, precise) }
    get buffered() { return this.selected.buffered }
    get currentTime() { return this.selected.currentTime }
    get duration() { return this.selected.duration }
    get durationMMSS() { return this.selected.durationMMSS }
    get error() { return this.selected.error }
    get muted() { return this.selected.muted }
    get networkState() { return this.selected.networkState }
    get paused() { return this.selected.paused }
    get playing() { return this.selected.playing }
    get playbackRate() { return this.selected.playbackRate }
    get readyState() { return this.selected.readyState }
    get seekable() { return this.selected.seekable }
    get volume() { return this.selected.volume }

    set currentTime(v) { return this.selected.currentTime(v) }
    set loop(v = !this.loop) {
        this.#loop = !!v;
    }
}

customElements.define("amplfr-item", AmplfrItem);
customElements.define("amplfr-audio", AmplfrAudio);
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

const createElement = (tagName, value) => {
    const element = document.createElement(tagName);

    if (!!value) {
        if (typeof value == "string") element.innerText = value;
        else {
            if (!!value.attributes) {
                Object.entries(value.attributes).forEach(([k, v]) => {
                    if (!!v) element.setAttribute(k, v);
                });
            }
            if (!!value.dataset)
                Object.entries(value.dataset).forEach(([k, v]) => {
                    if (!!v) element.setAttribute(`data-${k}`, v);
                });
            if (!!value.innerText) element.innerText = value.innerText;
        }
    }

    return element;
};
