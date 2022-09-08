const sidebar = document.querySelector("#sidebar");
const queuecontrols = sidebar.querySelector("#queue-controls");
const queuelist = sidebar.querySelector("#queue");

const playing = document.querySelector("#playing");
const play = document.querySelector("#play");
sidebar.isClosed = () => {
  return Object.values(sidebar.classList).includes("closed");
};

const listeners = ["click", "touchend"];
const setupInterface = (elementFunctionPairs, listeners) => {
  Object.keys(elementFunctionPairs).forEach((b) => {
    let e = document.querySelector(b);
    let fn = elementFunctionPairs[b];

    if (fn == null) return;
    listeners.forEach((L) => {
      e.addEventListener(L, fn);
    });
  });
};

const queueButton = document.querySelector("#queueIcon");
const sidebarToggle = (e) => {
  e.preventDefault();
  if (sidebar.isClosed()) {
    // open the sidebar and scroll to the Queue
    sidebar.classList.remove("closed");
    // sidebar.querySelector("#queuelist").scrollIntoView();
    // queuecontrols.scrollIntoView(true);
  } else sidebar.classList.add("closed");
  // searchbar.classList.toggle("narrow");
  queueButton.classList.toggle("selected");
};
// queueButton.addEventListener("click", sidebarToggle);
// queueButton.addEventListener("touchend", sidebarToggle);
setupInterface({ "#queueIcon": sidebarToggle }, listeners);

// from https://www.sitepoint.com/community/t/flatten-array-with-nodelists-htmlcollections-strings-etc/365309/2
const flatten = (arr) =>
  arr.flatMap((e) => (typeof e[Symbol.iterator] === "function" ? [...e] : e));

class Player {
  #play = null; // the play element
  #playing = null; // what's playing right now
  #playingMedia = null; // the media element for what's playing right now
  #queue = null; // list of Items (in order) to play next
  #played = []; // previously played Item(s) (no more than a few to keep memory use down)
  #observer = null;
  #totalDuration = 0;
  #totalDurationLabel;
  #queueSorted = null;
  #preloadCount = 2; // navigator.hardwareConcurrency || 4; // max number of items to preload

  constructor(ol, playing, play) {
    this.#queue = ol;
    this.#playing = playing;
    this.#play = play;
    // this.#totalDurationLabel =
    //   this.#queue.parentElement.querySelector("#queue-totaltime");

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
  #setupItem(item, insertAt = -1, alreadyBuilt = false) {
    let obj;
    if (alreadyBuilt) obj = item;
    // else obj = this.#buildItem(item);
    else obj = new ItemElement(item);

    // if nothing is playing, promote() the first item in the Queue
    if (this.#playing.childElementCount === 0) {
      this.#promote(obj);
      return; // don't bother adding anything else
    }

    // preload the necessary number of Items
    if (insertAt <= this.#preloadCount || this.length <= this.#preloadCount)
      this.#preload(obj);

    // create a LI element to put obj into
    const li = document.createElement("li");
    li.appendChild(obj);
    obj = this.#domInsert(insertAt, li); // add obj to the queue DOM

    obj.addEventListener("click", (e) => {
      if (e.target.localName != "i")
        e.currentTarget.classList.toggle("selected");
    });
    // obj.querySelector(".itemRemove").addEventListener("click", (e) => {
    //   // find the closest ancestor li.item element (this), and remove it
    //   e.target.closest("li.item").remove();
    // });
  }
  /**
   * Preload the media object
   * @param {Element} e The element to append the Media node to
   * @returns
   */
  async #preload(e) {
    const id = e.amplfrid;
    let media = e.querySelector(`#play-${id}`);
    if (media) return;

    try {
      const media = document.createElement("audio");
      media.controls = false; // no native controls
      media.preload = "metadata";
      media.id = `play-${id}`;

      const files = await this.#getJSON(`/api/${id}.files`);
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
  #promote(itemElement = this.#queue.firstElementChild) {
    itemElement = itemElement.querySelector(".item") || itemElement;

    // make sure the media is setup by passing itemElement
    //  do this early
    this.#preload(itemElement);

    // save what was in Playing
    const lastPlayed = this.#playing.firstElementChild;
    if (lastPlayed != null) this.#played.push(lastPlayed);

    // this.#playing.replaceChild(itemElement, lastPlayed);
    this.#playing.innerHTML = ""; // clear out whatever was in Playing
    this.#playing.appendChild(itemElement); // save itemElement to Playing
    this.#playingMedia = itemElement.querySelector("audio");

    // since this will be called often, don't call this.remove(0)
    if (
      this.#queue.firstElementChild != null &&
      this.#queue.firstElementChild.innerHTML === ""
    )
      this.#queue.removeChild(this.#queue.firstElementChild);
  }
  #demote(itemElement = this.#playing.firstElementChild) {
    // get the most recent item from #played
    const playedItem = this.#played.pop();
    if (playedItem == null) return;

    // get the item and prepend it back onto the Queue
    itemElement = itemElement.querySelector(".item") || itemElement;
    this.prepend(itemElement);

    this.#playing.innerHTML = ""; // clear out whatever was in Playing
    this.#playing.appendChild(playedItem); // save prevItem to Playing
    this.#playingMedia = playedItem.querySelector("audio");
  }

  get length() {
    return this.#queue.childElementCount;
  }
  at(position) {
    return Array.prototype.at.call(this.#queue.children, position).firstChild;
  }
  item(x) {
    return this.#queue.children.item(x).firstChild;
  }
  namedItem(x) {
    return this.#queue.children.namedItem(x).firstChild;
  }
  first() {
    return this.at(0);
  }

  // player controls
  play(x = null) {
    // TODO something better than nothing
    if (this.#playingMedia == null) {
      this.#promote(); // see if there's something in the Queue to be loaded
      return;
    }

    if (this.paused()) {
      this.#playingMedia.play();
      this.#play.innerHTML = "pause";
    } else {
      this.#playingMedia.pause();
      this.#play.innerHTML = "play_arrow";
    }
  }
  paused() {
    // if #playingMedia is null, then short-circuits to false
    // return !!this.#playingMedia && this.#playingMedia.paused;
    return (this.#playingMedia && this.#playingMedia.paused) || true;
  }
  /**
   * Pause currently playing Item
   */
  pause() {
    if (!!this.#playingMedia) this.#playingMedia.pause();
  }
  /**
   * Play next Item
   */
  next() {
    let wasPlaying = !this.paused();
    this.#promote();

    if (wasPlaying) this.play();
  }
  /**
   * Play previous Item
   */
  previous() {
    let wasPlaying = !this.paused();
    if (!!this.#played && this.#played.length > 0) this.#demote();

    if (wasPlaying) this.play();
  }
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
      items = [position];
      position = -1;
    }

    // check if items need to be fluffed before continuing
    if (items.length == 1) {
      // maybe its an ID
      if (typeof items[0] == "string")
        return this.add(position, await this.#getJSON(`/api/${items[0]}.json`));
      // if items is a nested array, flatten() it
      if (Array.isArray(items[0])) items = flatten(items); // if its a nested array
    }

    // if position is an existing (valid integer) number
    if (position >= 0 && position < this.length)
      // run through the items[] in reverse order
      items.reverse();

    await items.forEach(async (item, offset) => {
      // if item is just a URL
      if (typeof item == "string")
        return await this.add(position + offset, item); // re-run add() to get the JSON

      //   if item is an already built ItemElement
      if (item instanceof ItemElement)
        return this.#setupItem(item, position, true);

      // if there is an .items with an array of items
      if (item.items && Array.isArray(item.items))
        return await this.add(position + offset, item.items); // add all of the i.items

      if (item.dataset && item.dataset.id) item = item.dataset;
      if (item.id) {
        this.#setupItem(item, position);
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

const addListeners = (e, fn, ...listeners) => {
  listeners.forEach((L) => {
    e.addEventListener(L, fn);
    // e.addEventListener(L, function () { fn(); });
  });
};

const Q = new Player(queuelist, playing, play);
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

// tie the Player controls to their respective Player functions
//  based on [https://stackoverflow.com/a/21299126]
// prettier-ignore
const elementFunctionPairs = {
  "#play": function (e) { e.preventDefault(); Q.play() },
  "#player #previous": function (e) { e.preventDefault(); Q.previous() },
  "#player #repeat": null,
  "#player #shuffle": null,
  "#player #next": function (e) { e.preventDefault(); Q.next() },
};
setupInterface(elementFunctionPairs, listeners);
