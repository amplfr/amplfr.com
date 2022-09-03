class ItemElement extends HTMLDivElement {
  #type = "item";
  #isBuilt = false;

  constructor(src) {
    super(); // Always call super first in constructor

    if (!!src) {
      if (typeof src == "string")
        // src is an ID
        // this.#isBuilt = this.fetch(src)
        this.fetch(src).then((rv) => {
          this.#isBuilt = rv;
        });
      if (typeof src == "object")
        // src is an Item object
        this.#isBuilt = src;
    }
  }

  #buildArtwork() {
    let artwork = this.#isBuilt["albumid"] ?? `item/${this.#isBuilt["id"]}`;
    if (artwork == null) return;

    const e = document.createElement("div");
    e.setAttribute("class", "artwork");
    e.setAttribute("tabindex", 0);

    artwork = `/albumart/${artwork}.jpg`;
    e.style.backgroundImage = `url(${artwork})`;

    return e;
  }
  #buildArtists() {
    const attributes = ["name", "area", "started", "ended"];
    const artists = this.#isBuilt["artists"];
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
        const child = document.createElement("span");
        buildArtistElement(artist, child);
        e.appendChild(child);
      });
    else buildArtistElement(artists[0], e); // populate E with the single artist

    return e;
  }
  #build() {
    if (this.#isBuilt == true) return; // no need to build again if already done so

    // use the attributes from either the passed Item object, or the HTMLElement.dataset
    const src = this.#isBuilt || this.dataset;
    const useShadow = false; // toggle if resulting elements should go in shadow DOM instead
    let container;

    if (useShadow) container = document.createElement("div");
    else container = this;
    container.setAttribute("class", this.#type);

    container.dataset.id = src.id;
    container.appendChild(this.#buildArtwork(src)); // handle special case artwork
    container.appendChild(this.#buildArtists(src)); // handle special case artists

    // list of additional child tags to populate
    const childTags = ["title", "collection"];
    childTags.forEach(function (tag, t, arr) {
      if (!!src[tag]) {
        // Take attribute content and save it to container's dataset, and inside the childElement div
        const text = src[tag];

        container.dataset[tag] = text;

        const e = document.createElement("div");
        e.setAttribute("class", tag);
        e.textContent = text;

        container.appendChild(e);
      }
    }, this);

    this.#isBuilt = true; // get here, and there's no need to run it again
    if (!useShadow) return;
    const shadow = this.attachShadow({ mode: "open" }); // Create a shadow root

    // Apply external styles to the shadow dom
    const linkElem = document.createElement("link");
    linkElem.setAttribute("rel", "stylesheet");
    linkElem.setAttribute("href", "/css/item.css");

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

  static async fetch(id) {
    const validID =
      /[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{22}/;
    // if id is a string, then try to
    if (typeof id == "string" || !validID.test(id)) {
      const err = new Error();
      err.name = "InvalidRequest";
      err.message = "An invalid ID was used.";
      throw err;
    }

    const req = await fetch(`/api/${id}.json`);
    return await req.json();
  }

  get amplfrid() {
    // ID may be found in a few different spots, especially depending on the phase
    return this?.dataset?.id || this?.shadowRoot?.id || this.#isBuilt?.id;
  }
}

customElements.define("amplfr-item", ItemElement, { extends: "div" });
