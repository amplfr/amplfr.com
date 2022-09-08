class AlbumElement extends HTMLDivElement {
  #type = "album";
  #isBuilt = false;

  constructor(src) {
    super(); // Always call super first in constructor

    if (!!src) {
      if (typeof src == "string")
        // src is an ID, so build() will fetch() and process
        this.#isBuilt = src;
      // this.#isBuilt = this.fetch(src)
      // fetch(`/api/album/${src}.json`)
      //   .then((req) => req.json())
      //   .then((rv) => {
      //     this.#isBuilt = rv;
      //   });
      else if (typeof src == "object")
        // src is an Item object
        this.#isBuilt = src;
    }
  }

  #buildArtwork(src) {
    let artwork = src["id"];
    if (artwork == null) return;

    const e = document.createElement("div");
    e.setAttribute("class", "artwork");
    e.setAttribute("tabindex", 0);

    artwork = `/albumart/${artwork}.jpg`;
    e.style.backgroundImage = `url(${artwork})`;

    return e;
  }
  #buildArtists(src) {
    const attributes = ["name", "area", "started", "ended"];
    const artists = src["artists"];
    if (artists == null) return;

    const e = document.createElement("div");
    e.setAttribute("class", "artists");

    const buildArtistElement = (artist, rootElement) => {
      // assign dataset from attributes
      this.#assignDataset(rootElement.dataset, artist, attributes);
      rootElement.dataset.id = `artist-${artist.id}`;
      rootElement.textContent = artist.name;
    };

    if (artists.length > 1)
      // create a child element for each Artist, populate it, and append it to e
      artists.forEach((artist) => {
        const child = document.createElement("div");
        buildArtistElement(artist, child);
        child.setAttribute("class", "artist");
        child.setAttribute("is", "amplfr-artist");
        e.appendChild(child);
      });
    else buildArtistElement(artists[0], e); // populate E with the single artist

    return e;
  }
  #buildItems(src) {
    const items = src["items"];
    if (items == null) return;

    // const e = document.createElement("div");
    const e = document.createElement("ol");
    e.setAttribute("class", "items");

    const buildItemElement = (item, rootElement) => {
      // assign dataset from attributes
      this.#assignDataset(rootElement.dataset, item, ["title", "duration"]);
      rootElement.dataset.id = `amplfr-${item.id}`;
      rootElement.textContent = item.title;
    };

    // create a child element for each item, populate it, and append it to e
    items.forEach((item) => {
      const child = document.createElement("div");
      buildItemElement(item, child);
      child.setAttribute("class", "item");
      child.setAttribute("is", "amplfr-item");

      const li = document.createElement("li");
      li.appendChild(child);
      e.appendChild(li);
    });

    return e;
  }
  #buildReleased(src) {
    let released = src["released"];
    if (released == null) return;

    const e = document.createElement("div");
    e.setAttribute("class", "released");

    released = new Date(released);
    // released = released.toISOString(); // convert to ISO format - YYYY-MM-DDTHH:mm:ss.sssZ
    // released = released.split("T")[0]; // just keep the date portion - YYYY-MM-DD
    released = new Intl.DateTimeFormat().format(released);
    e.innerText = released;

    return e;
  }
  async #build() {
    if (this.#isBuilt == true) return; // no need to build again if already done so

    // use the attributes from either the passed Item object, or the HTMLElement.dataset
    let src = this.#isBuilt || this.dataset;
    if (
      typeof src == "string" ||
      (Object.keys(src).length === 1 && src.id) ||
      !!this.href
    ) {
      // if we only have the ID, then fetch(ID) the rest of the data
      const req = await fetch(`/api/${this.#type}/${src.id || src}.json`);
      src = await req.json();
    } else if (Object.keys(src).length < 1) return; // if there's no info, then there's nothing else to do

    const useShadow = false; // toggle if resulting elements should go in shadow DOM instead
    let container;
    if (useShadow) container = document.createElement("div");
    else container = this;
    container.setAttribute("class", this.#type);

    container.dataset.id = src.id;
    container.appendChild(this.#buildArtwork(src)); // handle special case Artwork
    // handle the other special cases after the childTags

    // list of additional child tags to populate
    // const childTags = ["title", "countries"];
    const childTags = ["title"];
    childTags.forEach((tag) => {
      if (src[tag]) {
        // Take attribute content and save it to container's dataset, and inside the childElement div
        let text = src[tag];

        container.dataset[tag] = text;

        const e = document.createElement("div");
        e.setAttribute("class", tag);
        e.textContent = text;

        container.appendChild(e);
      }
    });

    container.appendChild(this.#buildArtists(src)); // handle special case Artists
    // container.appendChild(this.#buildReleased(src)); // handle special case Released
    container.appendChild(this.#buildItems(src)); // handle special case Items

    // set the element title
    let released,
      title = src.title;
    try {
      released = new Date(released);
      released = new Intl.DateTimeFormat().format(released);
      title += ` (released)`;
    } catch (error) {}
    title += ` - ${src.artists.map((a) => a.name).join(", ")}`;
    container.setAttribute("title", title);

    this.#isBuilt = true; // get here, and there's no need to run it again
    if (!useShadow) return;
    const shadow = that.attachShadow({ mode: "open" }); // Create a shadow root

    // Apply external styles to the shadow dom
    const linkElem = document.createElement("link");
    linkElem.setAttribute("rel", "stylesheet");
    linkElem.setAttribute("href", "/css/album.css");

    // Attach the created elements to the shadow dom
    shadow.appendChild(linkElem);
    shadow.appendChild(container);
  }

  #assignDataset(datasetObj, obj, keys = null) {
    keys = keys || Object.keys(obj);
    keys.forEach((k) => {
      if (!!obj[k]) datasetObj[k] = obj[k];
    });
  }

  /**
   * connectedCallback() is called when this element is (re-)added to the DOM, but once is enough for each element
   */
  async connectedCallback() {
    await this.#build();
  }

  disconnectedCallback() {}

  adoptedCallback() {}

  attributeChangedCallback(name, oldValue, newValue) {}

  get amplfrid() {
    // ID may be found in a few different spots, especially depending on the phase
    return this?.dataset?.id || this?.shadowRoot?.id || this.#isBuilt?.id;
  }
}

customElements.define("amplfr-album", AlbumElement, { extends: "div" });
