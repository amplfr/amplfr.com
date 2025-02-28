/**
 * AmplfrQueue is an HTML element comprised of a list of {@link AmplfrItem}s, like an {@link AmplfrCollection} but is modifiable.
 * The additional methods (e.g. {@link AmplfrQueue#splice}) modify the list of items, akin to an array
 * @name AmplfrQueue
 * @see {@link AmplfrItem}
 * @see {@link AmplfrCollection}
 * @class
 * @extends {AmplfrCollection}
 * 
 * Displayed the same as AmplfrItem if only one Item is listed, but as a list otherwise
 */
class AmplfrQueue extends AmplfrCollection {
  constructor(src) {
    if (!src)
      src = '/queue' // '/api/queue'

    //   super(src); // Always call super first in constructor
    // }
    // constructor(src) {
    // super();
    super(src);
  }

  /**
   * Changes the contents of the Queue by removing or replacing existing {@link AmplfrItem}s and/or adding new {@link AmplfrItem}s in place.
   * Based on (and uses) [Array.prototype.splice()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice).
   * @param {Number} [start= -1]
   * @param {Number} deleteCount 
   * @param  {...any} items One or more {@link AmplfrItem}s
   */
  splice(start = -1, deleteCount = 0, ...items) {
    // based on https://gist.github.com/Daniel-Hug/05bfef7b276bbd5c492e
    const childNodes = this.childNodes
    const removedNodes = []

    // if `start` is negative, begin that many nodes from the end
    start = start < 0 ? childNodes.length + start : start

    // remove the element at index `start` `deleteCount` times
    const stop = typeof deleteCount === 'number' ? start + deleteCount : childNodes.length;
    for (let i = start; i < stop && childNodes[start]; i++)
      removedNodes.push(this.removeChild(childNodes[start]));

    // add items at index `start`
    items = items.flat()  // need to use flat() and then map(), so flatMap() doesn't work here

    // stick nodes in a document fragment
    let docFrag = document.createDocumentFragment();
    items.forEach(item => {
      // if item isn't an AmplfrItem, make it so
      if (!(item instanceof AmplfrItem))
        item = new AmplfrItem(item)

      docFrag.appendChild(item);
    });

    this.insertBefore(docFrag, childNodes[start]);  // place in `this` at index `start`

    return removedNodes;
  }
  /**
     * Add one or more {@link AmplfrItem}s to the end of the Queue
     * @param  {...any} items One or more {@link AmplfrItem}s
     * {@link AmplfrItem}
     * @returns Length of the Queue after the additional {@link AmplfrItem}s have been added
     */
  async push(...items) {
    await this.splice(-1, 0, items)
    return this.length
  }
  /**
   * Add one or more {@link AmplfrItem}s to the beginning of the Queue
   * @param  {...any} items One or more {@link AmplfrItem}s
   * {@link AmplfrItem}
   * @returns Length of the Queue after the additional {@link AmplfrItem}s have been added
   */
  async unshift(...items) {
    await this.splice(0, 0, items)
    return this.length
  }

  /**
   * shuffles the current this.items
   */
  shuffle() {
    let i, m = this.items.length;
    let timesToLoop = Math.min(1, Math.round(Math.log2(m)))
    const items = this.items;   // uses only existing AmplfrItems
    const childNodes = this.childNodes; // need the childNodes of items

    const wasLooped = this.loop
    const isPlaying = this.playing
    if (isPlaying === true)
      this.pause();

    this.loop = false
    // this.item = false;  // unload anything that might be playing first

    // mark the items in order so it can be undone by this.sort()
    items.forEach((item, n) => {
      item.setAttribute('num', n + 1)
    })

    // Fisher-Yates (aka Knuth) shuffle
    //  based on https://bost.ocks.org/mike/shuffle/
    while (timesToLoop) {
      while (m) {
        i = Math.floor(Math.random() * m);  // pick a random item from 0..m

        // ...and swap it with the current element.
        this.insertBefore(childNodes[m--], childNodes[i]);
      }
      timesToLoop--
    }

    this.loop = wasLooped  // restore previous loop status
    // this.item = 1   // load the new first item
    if (isPlaying)
      this.play()  // start playing again if were already doing so
  }
  sort(compareFn) {
    compareFn = compareFn || ((a, b) => {
      return a.getAttribute('num') - b.getAttribute('num')
    })

    return this.items.sort(compareFn);
  }

  get active() {
    // get what the current .active item is, or the first amplfr-item element
    return this.querySelectorAll("amplfr-item.active")[0] || this.items[0]
  }

  /**
   * Flatten the Item elements of any Collections within this Collection. 
   * Does not change the underlying Collection
   */
  flatten() {
    const subCollections = this.querySelectorAll(".collection")

    const outerCollection = this
    subCollections.forEach(subCollection => {
      const children = Array.from(subCollection.children)

      children.forEach(child => {
        // move child to in front of subCollection's position
        outerCollection.insertBefore(child, subCollection)

        child.classList.remove("active")
        child.dataset["collection"] = child.dataset["collection"] || subCollection?.id || subCollection?.url
      })

      outerCollection.removeChild(subCollection)  // remove the subCollection
    })
  }

  /**
   * Called when this element is (re-)added to the DOM. 
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements|MDN Using custom elements}
   */
  async connectedCallback() {
    // if (!!this.#observer) {
    //   // watch this for any added/removed child nodes
    //   this.#dom.observer = new MutationObserver(this.#observer)
    //   this.#dom.observer.observe(this, {
    //     childList: true,
    //   })
    // }
    this.addEventListener("populated", () => this.flatten(), { once: true })
    this.addEventListener("changed", () => this.flatten())

    await super.connectedCallback()

    // this.flatten()
  }
}
// prettier-ignore
customElements.define("amplfr-queue", AmplfrQueue);
