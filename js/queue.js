let reorderStart = undefined;

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

const itemMenu = (e) => {
  const { clientX: mouseX, clientY: mouseY } = e;

  console.info(`itemMenu() - ${e.currentTarget} - ${mouseX},${mouseY}px (X,Y)`);

  // contextMenu.style.left = `${mouseX}px`;
  // contextMenu.style.top = `${mouseY}px`;
};

const queueButton = document.querySelector("#queueIcon");
const sidebarToggle = (e) => {
  e.preventDefault();
  // if (sidebar.isClosed()) {
  if (Object.values(sidebar.classList).includes("closed")) {
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

const defaultSkipTime = 10; // Time to skip in seconds by default
/**
 * Player handles both Queue (list of items to play in adjustable order) and playing the current item.
 * Queue has a list of item IDs/URLs all having their source URL, title, artist(s), and duration (or whatever is known)
 * The first #preloadCount items in Queue have #setupMedia() run to setup each with its requested content metadata, ready to play.
 *    The URL of each item determines which #preload() and #setupMedia() is run, to address any specifics
 *      - YouTube [https://developers.google.com/youtube/iframe_api_reference]
 *        -
 */
class Player {
  #play = null; // the play element
  #player = null; // the player (controls) parent element
  #playerTime = null;
  #timeForward = true;
  #playing = null; // what's playing right now
  #playingMedia = null; // the media element for what's playing right now
  #queue = null; // list of Items (in order) to play next
  // #played = []; // previously played Item(s) (no more than a few to keep memory use down)
  #history = null; // previously played Item(s)
  #observer = null;
  #totalDuration = 0;
  #totalDurationLabel;
  #queueSorted = null;
  #preloadCount = 2; // navigator.hardwareConcurrency || 4; // max number of items to preload

  // prettier-ignore
  constructor() { // constructor(ol, playing, play, player, history) {
    const sidebar = document.querySelector("#sidebar");

    this.#queue = sidebar.querySelector("#queue"); // ol;
    this.#playing = sidebar.querySelector("#playing"); // playing;
    this.#play = sidebar.querySelector("#play"); // play;
    this.#player = sidebar.querySelector("#player"); // player;
    this.#playerTime = this.#player.querySelector("#time"); // player.querySelector("#time");
    this.#history = sidebar.querySelector("#history"); // history;

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
  /**
   * Called by add() to add item to Queue, and add appropriate Event Listeners
   * @param {Object|AmplfrItem|String} item
   * @param {Number} insertAt The position in Queue where to add item; -1 indicates at the end of the Queue
   * @param {boolean} alreadyBuilt True only if item is already an ItemElement
   */
  async #setupItem(item, insertAt = -1, alreadyBuilt = false) {
    let obj;
    if (alreadyBuilt) obj = item;
    else {
      // if (!item.artwork)
      //   item.artwork =
      //     "/artwork/" + (item.albumid ?? `item/${item.id}` + ".jpg");
      // item = item.id || item;
      obj = new AmplfrItem(item);
    }

    // preload the necessary number of Items
    if (insertAt <= this.#preloadCount && this.length <= this.#preloadCount)
      // this.#preloadMedia(obj);
      obj.appendMedia();

    const li = document.createElement("li"); // create a LI element to put obj into
    obj.classList.add("item"); // ensure obj has class 'item'
    li.appendChild(obj);
    obj = this.#domInsert(insertAt, li); // add obj to the queue DOM

    // if nothing is playing, promote() the first item in the Queue
    if (
      (insertAt == 0 || this.length == 1) &&
      this.#playing.childElementCount === 0
    ) {
      this.#promote(obj);
      // return; // don't bother adding anything else
    }

    obj.addEventListener("dblclick", (e) => {
      e.preventDefault();
      this.play(e.currentTarget.firstElementChild);
    });
    obj.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      itemMenu(e);
    });

    // allow item to be re-ordered
    obj.addEventListener("mousedown", reorderStart);
    obj.addEventListener("dragenter", (e) => {
      e.stopPropagation();
    });
    obj.addEventListener("dragover", (e) => {
      e.stopPropagation();
    });
    obj.addEventListener("drop", (e) => {
      e.stopPropagation();
    });

    // if nothing is playing, promote() the first item in the Queue
    // if (
    //   (insertAt == 0 || this.length == 1) &&
    //   this.#playing.childElementCount === 0
    // )
    //   this.#promote(); // this.#promote(obj);
  }
  #setupMedia(mediaElement = this.#playingMedia) {
    if (!mediaElement || mediaElement.error) {
      // can't play
      // TODO disable the play button
      this.#updateTime("x:xx");
      let message = `Cannot play '${
        this.#playingMedia?.currentSrc ||
        this.#playing.querySelector(".item")?.dataset?.id ||
        "unknown"
      }'`;
      if (mediaElement.error.message)
        message += ` - ${mediaElement.error.message}`;
      console.warn(message);
      this.#play.innerHTML = "play_disabled";
      return;
    }
    this.#updateTime();

    const log = (msg) => console.log(`${mediaElement.src} - ${msg}`);
    const warn = (msg) => console.warn(`${mediaElement.src} - ${msg}`);

    let title = this.#playing.querySelector(".title")?.innerText || "";
    log(`loading ${title}...`);
    this.#play.innerHTML = "play_arrow";

    mediaElement.addEventListener("abort", (e) => warn("abort"));
    mediaElement.addEventListener("error", (e) => warn("error"));
    mediaElement.addEventListener("stalled", (e) => warn("stalled"));
    mediaElement.addEventListener("waiting", (e) => warn("waiting"));

    mediaElement.addEventListener("canplay", (e) => log("canplay"));
    mediaElement.addEventListener("canplaythrough", (e) =>
      log("canplaythrough")
    );
    mediaElement.addEventListener("durationchange", (e) => {
      log("durationchange");
      this.#updateTime(mediaElement.currentTime);
      updateMetadata();
    });
    mediaElement.addEventListener("emptied", (e) => log("emptied"));
    mediaElement.addEventListener("ended", (e) => {
      log("ended");
      this.next(); // play what's next
    });
    mediaElement.addEventListener("loadeddata", (e) => log("loadeddata"));
    mediaElement.addEventListener("loadedmetadata", (e) => {
      log("loadedmetadata");
      this.#updateTime(mediaElement.currentTime);
    });
    mediaElement.addEventListener("loadstart", (e) => log("loadstart"));
    mediaElement.addEventListener("pause", (e) => {
      log("pause");
      // if (e.currentTarget == this.#playingMedia) this.#play.innerHTML = "play_arrow";
      if (e.currentTarget != this.#playingMedia) return;
      this.#play.innerHTML = "play_arrow";
    });
    mediaElement.addEventListener("play", (e) => {
      log("play");
      // if (e.currentTarget == this.#playingMedia) this.#play.innerHTML = "pause";
      if (e.currentTarget != this.#playingMedia) return;
      this.#play.innerHTML = "pause";

      updatePositionState(); // Media is loaded, set the duration.
    });
    mediaElement.addEventListener("playing", (e) => log("playing"));
    mediaElement.addEventListener("progress", (e) => log("progress"));
    mediaElement.addEventListener("ratechange", (e) => log("ratechange"));
    // mediaElement.addEventListener("resize", (e) => log("resize"));
    mediaElement.addEventListener("seeked", (e) => log("seeked"));
    mediaElement.addEventListener("seeking", (e) => log("seeking"));
    mediaElement.addEventListener("suspend", (e) => log("suspend"));
    mediaElement.addEventListener("timeupdate", (e) => {
      // log("timeupdate");
      this.#updateTime(); // may need to debouce these updates
    });
    mediaElement.addEventListener("volumechange", (e) => log("volumechange"));

    /* Position state (supported since Chrome 81) */
    let updatePositionState = () => {};
    let updateMetadata = () => {};
    if ("mediaSession" in navigator) {
      const thisPlayer = this;
      let title = this.#playing.querySelector(".title")?.innerText || "";
      let artists = this.#playing.querySelector(".artists")?.innerText || "";
      let album = this.#playing.querySelector(".album")?.innerText || "";
      let artwork =
        this.#playing
          .querySelector(".artwork")
          ?.style?.backgroundImage.split('"')
          .filter((x) => x.startsWith("/"))[0] || "";

      updatePositionState = () => {
        if ("setPositionState" in navigator.mediaSession) {
          log(
            `Updating position state (duration: ${mediaElement.duration})...`
          );
          navigator.mediaSession.setPositionState({
            duration: mediaElement.duration || Infinity,
            playbackRate: mediaElement.playbackRate,
            position: mediaElement.currentTime,
          });
        }
      };
      updateMetadata = () => {
        log(`Playing '${title || ""}' track...`);
        navigator.mediaSession.metadata = new MediaMetadata({
          title,
          artist: artists,
          album,
          artwork: [
            {
              src: artwork,
            },
          ],
        });

        updatePositionState(); // Media is loaded, set the duration.
      };

      /* Previous Track & Next Track */
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        log('> User clicked "Previous Track" icon.');
        thisPlayer.previous();
      });

      navigator.mediaSession.setActionHandler("nexttrack", () => {
        log('> User clicked "Next Track" icon.');
        thisPlayer.next();
      });

      navigator.mediaSession.setActionHandler("seekbackward", (e) => {
        log('> User clicked "Seek Backward" icon.');
        const skipTime = e.seekOffset || defaultSkipTime;
        mediaElement.currentTime = Math.max(
          mediaElement.currentTime - skipTime,
          0
        );
        updatePositionState();
      });

      navigator.mediaSession.setActionHandler("seekforward", (e) => {
        log('> User clicked "Seek Forward" icon.');
        const skipTime = e.seekOffset || defaultSkipTime;
        mediaElement.currentTime = Math.min(
          mediaElement.currentTime + skipTime,
          mediaElement.duration
        );
        updatePositionState();
      });

      /* Play & Pause */
      // navigator.mediaSession.setActionHandler("play", async function () {
      navigator.mediaSession.setActionHandler("play", () => {
        log('> User clicked "Play" icon.');
        thisPlayer.play();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        log('> User clicked "Pause" icon.');
        thisPlayer.pause();
      });
      mediaElement.addEventListener("play", () => {
        navigator.mediaSession.playbackState = "playing";
      });
      mediaElement.addEventListener("pause", () => {
        navigator.mediaSession.playbackState = "paused";
      });

      /* Stop (supported since Chrome 77) */
      try {
        navigator.mediaSession.setActionHandler("stop", () => {
          log('> User clicked "Stop" icon.');
          // TODO: Clear UI playback...
        });
      } catch (error) {
        log('Warning! The "stop" media session action is not supported.');
      }

      /* Seek To (supported since Chrome 78) */
      try {
        navigator.mediaSession.setActionHandler("seekto", (e) => {
          log('> User clicked "Seek To" icon.');
          if (e.fastSeek && "fastSeek" in mediaElement) {
            mediaElement.fastSeek(e.seekTime);
            return;
          }
          mediaElement.currentTime = e.seekTime;
          updatePositionState();
        });
      } catch (error) {
        log('Warning! The "seekto" media session action is not supported.');
      }
    }
  }
  /**
   * Preload the media object
   * @param {Element} e The element to append the Media node to
   * @returns
   */
  async #preloadMedia(e) {
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
  async #promote(itemElement = this.#queue.firstElementChild) {
    itemElement = itemElement.querySelector(".item") || itemElement;
    const parentNode = itemElement.closest("li");

    // save what was in Playing
    const lastPlayed = this.#playing.firstElementChild;
    if (lastPlayed != null) {
      this.stop(); // stop playing (regardless if something is playing)
    }

    // add itemElement to (now emptied) Playing
    //  this is so adding multiple items won't trample whatever is already present
    this.#playing.innerHTML = ""; // clear out whatever was in Playing
    this.#playing.appendChild(itemElement); // save itemElement to Playing

    // make sure the media is setup by passing itemElement - do this early
    // await this.#preloadMedia(itemElement);
    await itemElement.appendMedia();

    // this.#playing.replaceChild(itemElement, lastPlayed);
    this.#playingMedia = itemElement.querySelector("audio");
    this.#setupMedia();

    // since this will be called often, don't call this.remove(0)
    if (parentNode != null && parentNode.innerHTML === "")
      this.#queue.removeChild(parentNode);
  }
  #demote(itemElement = this.#playing.firstElementChild) {
    // get the most recent item from #history
    const playedItem = this.#history.lastElementChild;
    if (playedItem == null) return;
    this.stop(); // stop playing (regardless if something is playing)

    // get the item and prepend it back onto the Queue
    itemElement = itemElement.querySelector(".item") || itemElement;
    this.prepend(itemElement);

    this.#playing.innerHTML = ""; // clear out whatever was in Playing
    this.#playing.appendChild(playedItem); // save prevItem to Playing
    this.#playingMedia = playedItem.querySelector("audio");
  }
  #updateTime(value = null) {
    if (this.#playerTime == null) return; // nothing to do if #playerTime isn't set

    // if not set, or value is a Number (float) use #playingMedia.currentTime's value (or "0:00")
    if (value == null || typeof value == "number") {
      if (this.#timeForward) value = this.#playingMedia?.currentTime;
      else
        value =
          (this.#playingMedia?.duration - this.#playingMedia?.currentTime) * -1;
      value = Number(value || 0).toMMSS();
    }
    this.#playerTime.innerText = value;
  }
  toggleTime(forward = null) {
    this.#timeForward = forward || !this.#timeForward; // || true;
    this.#updateTime();
  }

  get length() {
    return this.#queue.childElementCount;
  }
  at(position) {
    return Array.prototype.at.call(this.#queue.children, position)
      .firstElementChild;
  }
  item(x) {
    return this.#queue.children.item(x).firstElementChild;
  }
  namedItem(x) {
    return this.#queue.children.namedItem(x).firstElementChild;
  }
  first() {
    return this.at(0);
  }

  // player controls
  async play(x = this.#playingMedia) {
    x = x || this.#playing;

    if (x != this.#playingMedia) this.#promote(x);
    this.#playingMedia = x.querySelector("audio") || x;

    // TODO something better than nothing
    if (this.#playingMedia == null) {
      await this.#promote(); // see if there's something in the Queue to be loaded
      return;
    }

    // pause if not already
    if (!this.paused()) {
      this.#playingMedia.pause();
      return;
    }

    // play (so long as there are no errors)
    if (!this.#playingMedia.error) this.#playingMedia.play();
  }
  /**
   * Returns pause status of currently playing item
   * @return (boolean) True if currently playing item is paused, False if its playing, or NULL if neither
   */
  paused() {
    return this.#playingMedia && this.#playingMedia.paused;
  }
  /**
   * Pause currently playing Item
   * @return (boolean) True
   */
  pause() {
    if (!this.#playingMedia) return;

    this.#playingMedia.pause();
  }
  /**
   * Stops currently playing Item
   */
  stop() {
    if (!this.#playingMedia) return;

    this.#playingMedia.pause(); // stop playing
    this.#playingMedia.currentTime = this.#playingMedia.startTime || 0; // reset back to the beginning
  }
  /**
   * Play next Item
   */
  async next() {
    let wasPlaying = !this.paused();
    await this.#promote();

    if (wasPlaying) this.play();
  }
  /**
   * Play previous Item
   */
  previous() {
    let wasPlaying = !this.paused();
    // if (!!this.#played && this.#played.length > 0) this.#demote();
    if (!!this.#history && !!this.#history.firstElementChild) this.#demote();

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
      // if (typeof items[0] == "string")
      //   return this.add(position, await this.#getJSON(`/api/${items[0]}.json`));
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
        return await this.#setupItem(item, position, true);

      // if there is an .items with an array of items
      if (item.items && Array.isArray(item.items))
        return await this.add(position + offset, item.items); // add all of the i.items

      if (!!item.dataset && !!item.dataset.id) item = item.dataset;

      await this.#setupItem(item, position);
    });

    // if nothing is playing, promote() the first item in the Queue
    if (this.#playing.childElementCount === 0) this.#promote();
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
Number.prototype.toMMSS = function () {
  if (Number.isNaN(this.valueOf())) return "";
  let neg = this < 0 ? "-" : "";
  let t = Math.abs(this);
  let s = Math.round(t % 60),
    m = Math.floor(t / 60);

  if (m >= 60) m = `${m / 60}:${(m % 60).toString().padStart(2, "0")}`;
  return `${neg}${m}:${s.toString().padStart(2, "0")}`;
};

// const Q = new Player(queue, playing, play, player, history);
const Q = new Player();
({ reorderStart } = await import("./reorder.js"));

// tie the Player controls to their respective Player functions
//  based on [https://stackoverflow.com/a/21299126]
// prettier-ignore
const elementFunctionPairs = {
  "#play": function (e) { e.preventDefault(); Q.play() },
  "#player #previous": function (e) { e.preventDefault(); Q.previous() },
  "#player #repeat": null,
  "#player #shuffle": null,
  "#player #next": function (e) { e.preventDefault(); Q.next() },
  "#player #time": function (e) { e.preventDefault(); Q.toggleTime() },
};
setupInterface(elementFunctionPairs, listeners);

// allow URI(s) to be dropped on Queue
const dragStart = (e) => {
  console.log(`dragStart`);
  const data = e.dataTransfer;
  // call e.preventDefault() to *allow* something that matches to be dropped
  if (
    data.types.includes("x-amplfr/json") ||
    data.types.includes("x-amplfr/id") ||
    data.types.includes("x-amplfr/albumid") ||
    data.types.includes("text/uri-list")
  ) {
    e.preventDefault();
  }
};
const handleDrop = (e) => {
  e.preventDefault();
  console.log(`dragStart`);
  const data = e.dataTransfer;
  console.log(`drop - ${e.target} - ${data}`);

  let items;
  try {
    items = data.getData("x-amplfr/json");
    if (items) items = JSON.parse(items);
  } catch (err) {
    items = null;
  }
  if (!items) {
    items = data.getData("x-amplfr/id");
    items = items.split(/\s|\+|,|\n/);
  }

  Q.add(-1, items); // append new items to Q
};
queue.addEventListener("dragenter", dragStart);
queue.addEventListener("dragover", dragStart);
queue.addEventListener("drop", handleDrop);
