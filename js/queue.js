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
  constructor(data, options = true) {
    if (!data) data = '/api/queue'
    super(data, options); // Always call super first in constructor
  }

  /**
   * Changes the contents of the Queue by removing or replacing existing {@link AmplfrItem}s and/or adding new {@link AmplfrItem}s in place.
   * Based on (and uses) [Array.prototype.splice()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice).
   * @param {Number} [start= -1]
   * @param {Number} deleteCount 
   * @param  {...any} items One or more {@link AmplfrItem}s
   */
  async splice(start = -1, deleteCount = 0, ...items) {
    // create a child element for each item, populate it, and append it to e
    items = items.flat()  // need to use flat() and then map(), so flatMap() doesn't work here
    const promises = items.map(async obj => {
      // if item is already an AmplfrItem
      if (obj instanceof AmplfrItem) return obj;

      // check if domain is just an AmplfrID or AmplfrCollectionID
      if (AmplfrItem.isValidID(obj) || AmplfrCollection.isValidID(obj)) {
        // obj = document.location.origin + `/api/${obj}.json`
        // obj = await AmplfrCollection.parse(obj)
        obj = await AmplfrCollection.parse(document.location.origin + `/api/${obj}.json`)
      }

      if (obj?.items && obj.items.length > 0)
        // upgrade each item to be an AmplfrItem
        return obj.items.map(item => new AmplfrItem(item, this._options.media))

      return new AmplfrItem(obj, this._options.media); // upgrade item to be an AmplfrItem
    })

    Promise.allSettled(promises)
      .then(newItems => {
        newItems = newItems.map(e => e.value) || newItems
        newItems = newItems.flat()
        // splice in the new items 
        this._data.items.splice(start, deleteCount, newItems);

        const queue = this._options.items
        const items = this._options.items.childNodes
        const length = items.length
        if (start < 0) start = length + start + 1  // count from the end

        if (start < length) {
          newItems.forEach((newItem, i) => {
            const li = this._appendItem(newItem)
            queue.insertBefore(li, items.item(start + i))
          })
        }
        else {
          newItems.forEach(newItem => {
            const li = this._appendItem(newItem)
            queue.appendChild(li)
          })
        }
      })
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


  shuffle() {
    let i, m = this.length;
    const items = this._data.items;
    const list = this._options.items
    const childNodes = this._options.items.childNodes; // need the childNodes of items

    const wasLooped = this.loop
    const isPlaying = this.playing
    if (isPlaying === true) this.pause();
    this.loop = false
    this.item = false;  // unload anything that might be playing first

    // mark the items in order
    items.forEach((item, n) => { item.setAttribute('num', n) })

    // Fisher-Yates (aka Knuth) shuffle
    //  based on https://bost.ocks.org/mike/shuffle/
    while (m) {
      // pick a random item from 0..m
      i = Math.floor(Math.random() * m--);

      // ...and swap it with the current element.
      list.insertBefore(childNodes[m], childNodes[i]);
    }

    this.loop = wasLooped  // restore previous loop status
    this.item = 1   // load the new first item
    if (isPlaying) this.play()  // start playing again if were already doing so
  }
  sort(compareFn) {
    compareFn = compareFn || ((a, b) => {
      return a.getAttribute('num') - b.getAttribute('num')
    })

    return this._options.items.sort(compareFn);
  }
}
// prettier-ignore
customElements.define("amplfr-queue", AmplfrQueue, { extends: "div" });
