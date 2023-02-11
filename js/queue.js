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
  async push(...items) {
    await this.splice(-1, 0, items)
    return this.length
  }
  async unshift(...items) {
    await this.splice(0, 0, items)
    return this.length
  }

  shuffle() {
    let i, m = this.length;
    const items = this._data.items;
    const itemNodes = this._options.items;

    // mark the items in order
    items.forEach((item, n) => { item.setAttribute('num', n) })

    // Fisher-Yates (aka Knuth) shuffle
    //  based on https://bost.ocks.org/mike/shuffle/
    while (m) {
      items[m].setAttribute('num', m)

      // pick a random item from 0..m
      i = Math.floor(Math.random() * m--);

      // and swap it with the current element.
      //   t = this[m];
      //   this[m] = this[i];
      //   this[i] = t;
      itemNodes.insertBefore(itemNodes[m], itemNodes[i]);
    }
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
