class ItemElement extends HTMLDivElement {
  #isBuilt = false;
  constructor() {
    super(); // Always call super first in constructor
  }

  /**
   * connectedCallback() is called when this element is (re-)added to the DOM, but once is enough for each element
   */
  connectedCallback() {
    // no need to build again if already done so
    if (this.#isBuilt) return;

    const that = this; // in case this is changed
    const useShadow = false; // toggle if resulting elements should go in shadow DOM instead
    let container;
    if (useShadow) container = document.createElement("div");
    else container = that;
    container.setAttribute("class", "item");

    // handle special case artwork
    const artwork = document.createElement("div");
    artwork.setAttribute("class", "artwork");
    artwork.setAttribute("tabindex", 0);
    const artworkid =
      that.getAttribute("data-albumid") ??
      "item/" + that.getAttribute("data-id");
    const artworkURL = `/albumart/${artworkid}.jpg`;
    artwork.style.backgroundImage = `url(${artworkURL})`;
    container.appendChild(artwork);

    // list of child tags to populate
    const childTags = ["title", "artists", "collection"];
    childTags.forEach((tag) => {
      const dataTag = `data-${tag}`;
      if (that.hasAttribute(dataTag) || that.hasAttribute(tag)) {
        // Take attribute content and save it to container's dataset, and inside the childElement div
        const text = that.getAttribute(dataTag) || that.getAttribute(tag);

        container.dataset[tag] = text;

        const e = document.createElement("div");
        e.setAttribute("class", tag);
        e.textContent = text;

        container.appendChild(e);
      }
    });

    this.#isBuilt = true; // get here, and there's no need to run it again
    if (!useShadow) return;
    const shadow = that.attachShadow({ mode: "open" }); // Create a shadow root

    // Apply external styles to the shadow dom
    const linkElem = document.createElement("link");
    linkElem.setAttribute("rel", "stylesheet");
    linkElem.setAttribute("href", "/css/item.css");

    // Attach the created elements to the shadow dom
    shadow.appendChild(linkElem);
    shadow.appendChild(container);
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

    const req = await fetch(`/api/${item}.json`);
    const rv = await req.json();

    return buildItem(rv);
  }
}

customElements.define("amplfr-item", ItemElement, { extends: "div" });
