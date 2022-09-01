const sidebar = document.querySelector("#sidebar");
const queuecontrols = sidebar.querySelector("#queue-controls");
const queuelist = sidebar.querySelector("#queuelist");
const playing = sidebar.querySelector("#playing");
const poster = sidebar.querySelector("#poster");
sidebar.isClosed = () => {
  return Object.values(sidebar.classList).includes("closed");
};

const queueButton = document.querySelector("#headerPlayer");
const sidebarToggle = (e) => {
  e.preventDefault();
  if (sidebar.isClosed()) {
    // open the sidebar and scroll to the Queue
    sidebar.classList.remove("closed");
    // sidebar.querySelector("#queuelist").scrollIntoView();
    // queuecontrols.scrollIntoView(true);
    poster.scrollIntoView(true);
  } else sidebar.classList.add("closed");
  searchbar.classList.toggle("narrow");
  queueButton.classList.toggle("selected");
};
queueButton.addEventListener("click", sidebarToggle);
queueButton.addEventListener("touchend", sidebarToggle);

let queue = {};
let queueTotalDuration = 0; // in seconds

Number.prototype.toMMSS = function () {
  if (Number.isNaN(this.valueOf())) return "";
  let S = Math.round(this % 60)
    .toString()
    .padStart(2, "0");
  let M = Math.floor(this / 60);
  let h = "",
    d = "",
    w = "",
    m = "",
    y = "";

  if (M >= 60) {
    // m = `${Math.floor(m / 60)}:${(m % 60).toString().padStart(2, "0")}`;
    h = Math.floor(M / 60);
    M = (M % 60).toString().padStart(2, "0");
  }
  if (h >= 24) {
    // h = `${Math.floor(h / 24)}d ${(h % 24).toString().padStart(2, "0")}:`;
    d = Math.floor(h / 24);
    h = `${Math.floor(h % 24)}:`;
  } else if (h > 0) h = `${h}:`;
  // else h = "";
  if (d >= 7) {
    w = Math.floor(d / 7);
    d = `${Math.floor(d % 7)}d `;
  } else if (d > 0) d = `${d}d `;
  // else d = "";
  if (w >= 4) {
    m = Math.floor(w / 4);
    w = `${Math.floor(w % 4)}w `;
  } else if (w > 0) w = `${w}w `;
  // else w = "";
  if (m >= 12) {
    m = `${Math.floor(m % 12)}m `;
    y = `${Math.floor(m / 12)}y `;
  } else if (m > 0) m = `${m}m `;
  // else m = "";
  if (y > 0) {
    m = `${Math.floor(m % 12)}:`;
    y = Math.floor(m / 12);
  } else if (m > 0) m = `${m}:`;
  // else m = "";

  return `${y}${m}${w}${d}${h}${M}:${S}`;
};

class Queue extends Array {
  #originalOrder = null;
  #dom;
  #totalDuration = 0;
  #totalDurationLabel;
  constructor(itemArray = null, dom = null) {
    super();
    if (itemArray != null) this.push(itemArray);
    if (dom != null) this.domBind(dom);
  }

  async #getJSON(url) {
    let response = await fetch(url);
    return await response.json();
  }
  async loadFromURL(url = "/api/queue") {
    // let queue = await this.#getJSON(url);
    // this.push(queue);
    this.push(await this.#getJSON(url));
  }

  #updateTotalDuration() {
    if (this.#dom != null) {
      // determine the new total duration for the whole Queue
      this.#totalDuration = 0;
      this.#dom.querySelectorAll(".item").forEach((i) => {
        this.#totalDuration += Number(i.dataset.duration || 0);
      });
      this.#totalDurationLabel.innerText = Number(this.#totalDuration).toMMSS();
    }
  }
  #domInsert(dest, obj, insertAt = null) {
    let n = dest.childElementCount + 1; // how many items are already in the list

    if (
      insertAt >= 0 &&
      insertAt < dest.children.length &&
      dest.children[insertAt]
    ) {
      n = insertAt + 1;
      obj = dest.insertAdjacentElement("beforebegin", obj);
    } else {
      obj = dest.appendChild(obj);
    }

    return n;
  }

  domBind(dom) {
    if (!this.#dom && dom != null) this.#dom = dom;

    this.#totalDurationLabel =
      this.#dom.parentElement.querySelector("#queue-totaltime");

    this.list(false).forEach((e) => this.buildItem(this.#dom, e));
    this.#updateTotalDuration();
  }

  buildCollection(dest, collection, type) {
    let obj = collectionTemplate.content.cloneNode(true);

    collection.artists = Array.isArray(collection.artists)
      ? collection.artists.map((a) => a.name).join(", ")
      : collection.artists;
    collection.duration =
      collection.duration ||
      collection.items
        .map((i) => i.duration || 0)
        .reduce((acc, cur) => {
          acc + cur;
        });
    obj.querySelector(".title").innerText = collection.title;
    obj.querySelector(".duration").innerText = Number(
      collection.duration
    ).toMMSS();
    obj.querySelector(".artists").innerHTML = collection.artists;

    n = this.#domInsert(dest, obj, insertAt);

    obj = dest.children[n - 1]; // need to reassign before setAttribute() since obj was a document-fragment
    obj.dataset.number = n;
    obj.dataset.duration = collection.duration;
    obj.dataset.id = `${type}-${collection.id}`;
    obj.dataset.title = collection.title;
    obj.dataset.artists = collection.artists;
  }
  buildItem(dest, item, insertAt = null) {
    let n;
    let obj = itemQueueTemplate.content.cloneNode(true);

    item.artists = Array.isArray(item.artists)
      ? item.artists.map((a) => a.name).join(", ")
      : item.artists;
    obj.querySelector(".title").innerText = item.title;
    obj.querySelector(".duration").innerText = Number(item.duration).toMMSS();
    obj.querySelector(".artists").innerHTML = item.artists;

    n = this.#domInsert(dest, obj, insertAt);

    obj = dest.children[n - 1]; // need to reassign before setAttribute() since obj was a document-fragment
    obj.dataset.duration = item.duration;
    obj.dataset.id = item.id;
    obj.dataset.title = item.title;
    obj.dataset.artists = item.artists;

    // obj.addEventListener("click", (e) => {
    //   if (e.target.localName != "i")
    //     e.currentTarget.classList.toggle("selected");
    // });
    obj.addEventListener("click", this.#itemEvent);
    obj.querySelector(".itemRemove").addEventListener("click", (e) => {
      Q.append(e.currentTarget.parentNode.parentNode);
    });
  }

  // built-in methods will use this as the constructor
  static get [Symbol.species]() {
    return Array;
  }

  #pruneRemovedItem(i) {
    // make sure i isn't really an item
    if (i.id) i = i.id; // just need the ID

    // if i isn't still in the array
    if (!this.includes(i)) delete this[i]; // remove the corresponding item object
  }

  // functions to add one/more items
  // push(isCollection=false, ...items) {
  async push(...items) {
    if (typeof items == "string") {
      return this.push(await this.#getJSON(items));
      // return this.#getJSON(items).then(rv => this.push(rv))
    }
    if (!items.length) items = [items];
    else {
      items = Array.from(...items);
      items = items.flat();
    }
    let len = 0;
    let dom = this.#dom;

    // make sure
    items.forEach((i) => {
      // if i is just a URL
      if (typeof i == "string") return this.push(i); // add all of the i.items

      // if there is an .items with an array of items
      if (i.items && Array.isArray(i.items)) return this.push(i.items); // add all of the i.items

      if (i.dataset && i.dataset.id) i = i.dataset;
      if (i.id) {
        if (!this[i.id]) this[i.id] = i; // save the full item object
        len = super.push(i.id); // just add the item.id to the array
        // if (this.#dom != null) this.buildItem(this.#dom, i);
        if (dom != null) this.buildItem(dom, i);
      }
    });

    this.#updateTotalDuration();
    return len; // return the length of the array from the last successfull array op
  }
  unshift(...items) {
    if (!Array.isArray(items)) items = [items];
    else items = items.flat();
    let len = 0;

    // make sure
    items.forEach((i) => {
      // if there is an .items with an array of items
      if (i.items && Array.isArray(i.items))
        return this.unshift(i.items.reverse()); // add all of the i.items in reverse order

      if (i.dataset.id) i = i.dataset;
      if (i.id) {
        if (!this[i.id]) this[i.id] = i; // save the full item object
        len = super.unshift(i.id); // just add the item.id to the array
        if (this.#dom != null) this.buildItem(this.#dom, i, 0);
      }
    });

    this.#updateTotalDuration();
    return len; // return the length of the array from the last successfull array op
  }
  insertAt(index, ...items) {
    if (!Array.isArray(items)) items = [items];
    else items = items.flat();

    let expandedList = [];

    // make sure
    items.forEach((i) => {
      // if there is an .items with an array of items
      if (i.items && Array.isArray(i.items))
        i.items.forEach((e) => {
          if (e.id) expandedList.push(e.id);
        });
      else if (i.id) expandedList.push(i.id);
    });

    super.splice(index, 0, ...expandedList);

    this.#updateTotalDuration();
    return this.length;
  }

  // functions that can remove one/more items
  pop(justID = false) {
    const removed = super.pop();
    this.#pruneRemovedItem(removed);

    this.#updateTotalDuration();
    if (justID) return removed;
    else return this[removed];
  }
  shift(justID = false) {
    const removed = super.shift();
    this.#pruneRemovedItem(removed);

    this.#updateTotalDuration();
    if (justID) return removed;
    else return this[removed];
  }
  removeAt(justIDs = false, index, ...indexes) {
    if (indexes && Array.isArray(indexes) && indexes.length > 0) {
      indexes.unshift(index);
      // since removing a lower indexed entry will shift those after it,
      // get the reverse-sorted list of positions
      indexes = index.sort().reverse();
      let rv = indexes.map((t, i) => this.removeAt(justIDs, i));

      if (justIDs) return rv.map((e) => e);
      else return rv.map((e) => rv[e]);
    }

    let obj = this[this[index]];
    let id = super.splice(index, 1);

    // remove the same object from the DOM
    // let domObj = this.#dom.childNodes[index];
    let domObj = this.#dom.children[index];
    domObj.remove();

    if (justIDs) return id;
    else return obj;
  }
  removeAll(justIDs = false) {
    return this.map((t, i) => {
      this.removeAt(justIDs, 0);
    });
  }

  toString() {
    //  return the IDs
    return this.join(" ");
  }

  // additional functions
  list(justIDs = false) {
    if (justIDs) return this.map((e) => e);
    else return this.map((e) => this[e]);
  }
  shuffle(justIDs = false) {
    this.#originalOrder = Array.from(this); // save the original order
    // this.#domOriginalChildren = this.#dom.children;
    let m = this.length,
      i;
    const domNodes = this.#dom.children;

    //Fisher-Yates (aka Knuth) shuffle
    //based on https://bost.ocks.org/mike/shuffle/
    while (m) {
      //pick a random item from 0..m
      i = Math.floor(Math.random() * m--);

      //and swap it with the current element.
      //   t = this[m];
      //   this[m] = this[i];
      //   this[i] = t;
      this.swap(m, i); // update the array
      domNodes[m].parentNode.insertBefore(domNodes[m], domNodes[i]); // update the DOM
    }

    this.list(justIDs);
  }
  sort(justIDs = false) {
    if (
      this.#originalOrder &&
      Array.isArray(this.#originalOrder) &&
      this.#originalOrder.length === this.length
    ) {
      // clear out the existing (shuffled) entries and append in the sorted entries
      this.splice(0, this.length, ...this.#originalOrder); // update the array
      // this.#dom.children.splice(0, this.length, ...this.#originalOrder); // update the DOM
      const items = this.#dom.querySelectorAll(".item");
      Array.from(items)
        .sort((a, b) => {
          return a.dataset.number < b.dataset.number ? -1 : 1;
        })
        .forEach((item, i) => {
          // this.#dom.querySelector(`[number=${i + 1}]`).remove(); // remove the first
          this.#domInsert(this.#dom, item); // append the item
        });
      this.#originalOrder = null;
      // this.#domOriginalChildren = null;
    }

    this.list(justIDs);
  }
  isShuffled() {
    return this.#originalOrder !== null;
  }
  unique(justIDs = false) {
    // add all of the IDs to a Set() to get unique entries
    const set = new Set(this.map((e) => e));
    const uniq = Array.from(set); // save the Set as an Array

    if (justIDs) return uniq.map((e) => e);
    else return uniq.map((e) => this[e]);
  }
  swap(fromIndex, toIndex) {
    let t = this[fromIndex];
    this[fromIndex] = this[toIndex];
    this[toIndex] = t;
  }
  reverse(justIDs = false) {
    let i = 0,
      j = this.length - 1;
    while (i < j) {
      this.swap(i, j);
      i++;
      j--;
    }

    this.list(justIDs);
  }

  /**
   * Deal with possible variations of clicking/tapping on an Item
   * @param {PointerEvent} event The [PointerEvent](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent) that occurred
   */
  #itemEvent(event) {
    if (event.target.localName != "i")
      event.currentTarget.classList.toggle("selected");

    /* Possiblities:
    // - click/tap on Item - show additional options
    // - double click/tap - play this Item now
    // - swipe right - 
    */
  }
}

// from https://www.sitepoint.com/community/t/flatten-array-with-nodelists-htmlcollections-strings-etc/365309/2
const flatten = (arr) =>
  arr.flatMap((e) => (typeof e[Symbol.iterator] === "function" ? [...e] : e));

class Player {
  #playing = null; // what's playing right now
  #poster = null; // image of what's playing
  #queue = null; // list of Items (in order) to play next
  #observer = null;
  #totalDuration = 0;
  #totalDurationLabel;
  #queueSorted = null;
  #preloadCount = 2; // navigator.hardwareConcurrency || 4; // max number of items to preload

  constructor(ol, playing, poster) {
    this.#queue = ol;
    this.#playing = playing;
    this.#poster = poster;
    this.#totalDurationLabel =
      this.#queue.parentElement.querySelector("#queue-totaltime");

    this.loadFromURL();
    this.#setupObserver();
  }

  async #getJSON(url) {
    let response;
    try {
      response = await fetch(url);
      // return await response.json();
      if (response.ok) return response.json();
    } catch (err) {
      console.log(err);
    }

    return false;
  }
  /**
   * Loads (appends) a list of items from given URL
   * @param {String} url The URL endpoint to fetch, and append() each item it returns. Defaults to "/api/queue"
   */
  async loadFromURL(url = "/api/queue") {
    this.add(-1, await this.#getJSON(url));
  }

  /**
   * Determine the new total duration for the whole Queue
   * @param {Number} seconds The number of seconds to add (or subtract if negative) to the total
   */
  #updateTotalDuration(seconds) {
    this.#totalDuration += Number(seconds || 0);

    // update the label in MM:SS format
    // this.#totalDurationLabel.innerText = Number(this.#totalDuration).toMMSS();
  }
  #domInsert(position = null, obj) {
    if (
      position >= 0 &&
      position < this.#queue.children.length &&
      this.#queue.children[position]
    ) {
      this.#queue.children[position].insertAdjacentElement("beforebegin", obj); // insert before the child at position index
      // this.#queue.insertAdjacentElement("afterbegin", obj);  // before the first child
      obj = this.#queue.children[position]; // get the complete object (and not just document-fragment)
    } else {
      this.#queue.appendChild(obj); // insert after the last child
      obj = this.#queue.lastElementChild; // get the complete object (and not just document-fragment)
    }

    return obj;
  }
  async #buildItem(item, insertAt = -1) {
    // include .firstElementChild so obj is not a DocumentFragment
    let obj = itemQueueTemplate.content.firstElementChild.cloneNode(true);
    const artists = Array.isArray(item.artists)
      ? item.artists.map((a) => a.name || a).join(", ")
      : item.artists;

    obj.querySelector(".title").innerText = item.title;
    obj.querySelector(".artists").innerHTML = artists;
    obj.querySelector(".duration").innerText = Number(item.duration).toMMSS();

    obj.id = `queue-${item.id}`;
    obj.title = item.title;
    obj.dataset.duration = item.duration;
    obj.dataset.id = item.id;
    obj.dataset.title = item.title;
    obj.dataset.artists = artists;

    // if nothing is playing, promote() the first item in the Queue
    if (this.#playing.childElementCount === 0) {
      this.#promote(obj);
      return; // don't bother adding anything else
    }

    // preload the necessary number of Items
    if (insertAt <= this.#preloadCount || this.length <= this.#preloadCount)
      this.#preload(obj);

    obj.appendChild(
      itemQueueOptionsTemplate.content.firstElementChild.cloneNode(true)
    );
    obj = this.#domInsert(insertAt, obj); // add obj to the queue DOM
    this.#updateTotalDuration(item.duration);

    obj.addEventListener("click", (e) => {
      if (e.target.localName != "i")
        e.currentTarget.classList.toggle("selected");
    });
    obj.querySelector(".itemRemove").addEventListener("click", (e) => {
      // find the closest ancestor li.item element (this), and remove it
      e.target.closest("li.item").remove();
    });
  }
  /**
   * Preload the media object
   * @param {Element} e The element to append the Media node to
   * @returns
   */
  async #preload(e) {
    let media = e.querySelector(`#play-${e.dataset.id}`);
    if (media) return;

    try {
      const media = document.createElement("audio");
      media.controls = false; // no native controls
      media.preload = "metadata";
      media.id = `play-${e.dataset.id}`;

      const files = await this.#getJSON(`/api/${e.dataset.id}.files`);
      if (files && files.length)
        files.forEach((f) => {
          if (f.mime) {
            // TODO determine a hierarchy of files to play, or append all of them as <source>s to media
            const canPlay = media.canPlayType(f.mime);
            if (canPlay == "probably") {
              media.type = f.mime;
              media.src = `/api/${f.filename}`;
            }
          }
        });

      if (media) e.appendChild(media);
    } catch (err) {
      console.log(err);
    }
  }
  #promote(item = this.#queue.firstElementChild) {
    this.#playing.innerHTML = item.innerHTML; // copy over the Item's elements from the Queue

    // create and insert icon before the first child
    const icon = document.createElement("span");
    icon.classList.add("icon", "material-symbols-outlined");
    icon.innerText = "volume_up";
    this.#playing.insertAdjacentElement("afterbegin", icon);

    // copy over the Item's dataset key-value pairs (needed)
    Object.entries(item.dataset).forEach(([k, v]) => {
      this.#playing.dataset[k] = v;
    });

    // update the poster and the Body background
    const posterSrc = `/albumart/item/${this.#playing.dataset.id}.jpg`;
    this.#poster.src = posterSrc;
    // document.body.style.setProperty("background-image", posterSrc, "important");
    document.body.style.backgroundImage = `url(${posterSrc})`;

    // make sure the media is setup
    this.#preload(this.#playing);

    // since this will be called often, don't call this.remove(0)
    if (item === this.#queue.firstElementChild) this.#queue.removeChild(item);
  }

  get length() {
    return this.#queue.childElementCount;
  }
  at(position) {
    return Array.prototype.at.call(this.#queue.children, position);
  }
  item(x) {
    return this.#queue.children.item(x);
  }
  namedItem(x) {
    return this.#queue.children.namedItem(x);
  }
  first() {
    this.at(0);
  }

  // player controls
  play(x = null) {}
  /**
   * Pause currently playing Item
   */
  pause() {}
  /**
   * Play next Item
   */
  next() {}
  /**
   * Play previous Item
   */
  previous() {}
  /**
   * Modifies the repeat behavior for the current Item. Defaults to False when a different Item is played.
   * @param {Boolean|Number|undefined} x Indicates how the current track will repeat
   *  True  Repeat until changed
   *  False Do not repeat again
   *  <Number>  Repeat for the specified number of times, and then continue. Each repeat causes the internal counter to decrement
   *  <Null>  Toggle between truthy (or last number) and False
   */
  repeat(x = null) {}

  /**
   * Convenience function to add items to the end of the Queue. @see this.add()
   * @param  {HTMLElement|String|QueueElement} items One or more items to add.
   */
  append(...items) {
    this.add(-1, flatten(items));
  }
  /**
   * Convenience function to add items to the beginning of the Queue. @see this.add()
   * @param  {HTMLElement|String|QueueElement} items One or more items to add.
   */
  prepend(...items) {
    // call this.add(), but flatten the array items (since its variadic)
    this.add(0, flatten(items));
  }
  /**
   * Add items to the Queue, inserting at position.
   * @param  {Number} position If position is between 0..length, then begin inserting there, otherwise append to the end of the Queue
   * @param  {HTMLElement|String|QueueElement} items One or more items to add. If String, then use this.fetcchJSON() to get data. Uses i.dataset to populate
   */
  async add(position = -1, ...items) {
    if (items.length === 0 && position != null) {
      items = position;
      position = -1;
    }
    if (typeof items == "string") {
      return this.add(await this.#getJSON(items));
    }
    if (!items.length) items = [items]; // just treat items as an array
    else items = flatten(items); // if its a nested array

    // if position is an existing (valid integer) number
    if (position >= 0 && position < this.length) {
      // run through the items[] in reverse order
      items.reverse();
    }

    await items.forEach(async (item, offset) => {
      // if i is just a URL
      if (typeof item == "string") return this.add(position + offset, item); // add all of the i.items

      // if there is an .items with an array of items
      if (item.items && Array.isArray(item.items))
        return this.add(position + offset, item.items); // add all of the i.items

      if (item.dataset && item.dataset.id) item = item.dataset;
      if (item.id) {
        await this.#buildItem(item, position);
      }
    });
  }

  remove(x) {
    if (typeof x == "number" && this.item(x) != null) x = this.item(x);
    else if (typeof x == "string" && this.namedItem(x) != null)
      x = this.namedItem(x);
    // else return; // don't do anything

    this.#queue.removeChild(x);
  }
  clear() {
    while (this.length > 0) this.remove(this.#queue.firstElementChild);
  }
  shuffle() {
    this.#queueSorted = Array.from(this.#queue.children); // save the original order
    let i;
    let m = this.length;
    const nodes = this.#queue.children;

    //Fisher-Yates (aka Knuth) shuffle
    //based on https://bost.ocks.org/mike/shuffle/
    while (m) {
      //pick a random item from 0..m
      i = Math.floor(Math.random() * m--);

      //and swap it with the current element.
      //   t = this[m];
      //   this[m] = this[i];
      //   this[i] = t;
      this.#queue.insertBefore(nodes[m], nodes[i]);
    }
  }
  isShuffled() {
    return this.#queueSorted != null;
  }
  sort() {
    if (
      this.#queueSorted &&
      Array.isArray(this.#queueSorted) &&
      this.#queueSorted.length === this.length
    ) {
      this.#queueSorted.forEach((item, i) => {
        this.#domInsert(i, item); // append the item
      });
      this.#queueSorted = null;
    }
  }
  // sortByDuration()
  #setupObserver() {
    const cb = (mutationList, observer) => {
      const added = {};
      const removed = {};
      for (const mutation of mutationList) {
        if (mutation.type === "childList") {
          let position =
            1 +
            [...mutation.target.childNodes].indexOf(mutation.previousSibling);
          const addedID = Array.from(mutation.addedNodes)
            .map((e) => {
              return e?.classList?.contains("item") ? e.dataset.id : null;
            })
            .join(",");
          const removedID = Array.from(mutation.removedNodes)
            .map((e) => {
              return e?.classList?.contains("item") ? e.dataset.id : null;
            })
            .join(",");
          console.log(`added ${addedID || ""} and removed ${removedID || ""}`);
        }
      }
    };

    this.#observer = new MutationObserver(cb);

    // Start observing the target node for child additions/removals
    this.#observer.observe(this.#queue, {
      childList: true,
    });
  }

  #destructor() {
    this.#observer.disconnect(); // stop observing
  }
}

// const Q = new Queue();
// Q.domBind(queuelist);
const Q = new Player(queuelist, playing, poster);
// const sortable = Sortable.create(queuelist, {
//   dataIdAttr: "data-id",
//   handle: "li.item:before",
//   ghostClass: ".sort-placeholder",
//   group: {
//     name: "list",
//     pull: true,
//     put: true,
//   },
// });

const controls = sidebar.querySelector("#queue-controls");

// const queueShuffle = controls.querySelector("#queueShuffle");
// queueShuffle.addEventListener("click", (e) => {
//   if (!Q.isShuffled()) {
//     Q.shuffle();
//     queueShuffle.innerText = "format_list_numbered";
//   } else {
//     Q.sort();
//     queueShuffle.innerText = "shuffle";
//   }
// });

// const queueDensity = controls.querySelector("#queueDensity");
// queueDensity.addEventListener("click", (e) => {
//   if (Object.values(queuelist.classList).includes("noartists")) {
//     queueDensity.innerText = "density_small";
//     queuelist.classList.remove("noartists");
//   } else {
//     queueDensity.innerText = "density_medium";
//     queuelist.classList.add("noartists");
//   }
// });

// const queueClear = controls.querySelector("#queueClear");
// queueClear.addEventListener("click", (e) => {
//   Q.clear();
// });
// const queueReload = controls.querySelector("#queueReload");
// queueReload.addEventListener("click", (e) => {
//   Q.loadFromURL();
// });
