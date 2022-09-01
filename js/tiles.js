const API = "caches" in self ? caches.open("api") : {};
const list = document.getElementById("list");
const infoContainer = document.getElementById("info");
const tileContainer = document.getElementById("recommended");
const tileAlbumTemplate = document.querySelector("template#tile-album");
const albumTemplate = document.querySelector("template#list-album");
const artistTemplate = document.querySelector("template#list-artist");
const itemTemplate = document.querySelector("template#list-item");
const itemQueueTemplate = document.querySelector("template#queue-item");
const itemQueueOptionsTemplate = document.querySelector(
  "template#queue-item-options"
);
const collectionTemplate = document.querySelector("template#list-collection");
const closeButtonHTML =
  '<a href="#"><i class="contents-close material-icons">close</i></a>';

const makeA = (obj, type = null) => {
  let typeDash = "";
  if (type && type != "") typeDash = `${type}-`;
  if (!obj.url)
    obj.url = `${document.baseURI}api/${type}/${obj.id}/${encodeURI(obj.name)}`;

  return `<a id="${typeDash}${obj.id}" name="${obj.name}" href="${obj.url}" class="link">${obj.name}</a>`;
};

const appendArtists = (dest, artists) => {
  artists.forEach((artist, i) => {
    let obj = artistTemplate.content.cloneNode(true);
    // listCount++
    obj.querySelector(".name").innerText = artist.name;
    obj.querySelector(".country").innerText = artist.country || "";
    // obj.querySelector(".link").href = `//mt5577:3000/api/artist/${
    //   artist.id
    // }/${encodeURI(artist.name)}`;

    dest.append(obj);

    // obj = list.lastElementChild // need to reassign before setAttribute() since obj was a document-fragment
    // obj.setAttribute('data-duration', item.duration)
    // let style = obj.getAttribute('style')
    // obj.setAttribute(
    //     'style',
    //     `background-image:url("/albumart/item/${item.id}.jpg");${style}`
    // )
  });
};

const buildItem = (item, template, dontShowArtists = false, num = null) => {
  let obj = template.content.cloneNode(true);
  obj.querySelector(".num").innerText = num;
  obj.querySelector(".title").innerText = item.title;
  obj.querySelector(".duration").innerText = Number(item.duration).toMMSS();
  if (!dontShowArtists) {
    // obj.querySelector(".artists").innerHTML = (item.artists || item.artist)
    //   .map((a) => a.name)
    //   .join(", ");
    obj.querySelector(".artists").innerHTML = item.artists;
  }

  return obj;
};
const appendItems = (dest, items, dontShowArtists = false) => {
  const n = dest.childElementCount + 1; // how many items are already in the list
  items.forEach((item, i) => {
    item.artists = (item.artists || item.artist).map((a) => a.name).join(", ");
    let obj = buildItem(item, itemTemplate, dontShowArtists, n + i);

    dest.append(obj);
    obj = dest.lastElementChild; // need to reassign before setAttribute() since obj was a document-fragment

    obj.dataset.number = n + i;
    obj.dataset.duration = item.duration;
    obj.dataset.id = item.id;
    obj.dataset.title = item.title;
    obj.dataset.artists = item.artists;

    obj.addEventListener("click", (e) => {
      if (e.target.localName != "i")
        e.currentTarget.classList.toggle("selected");
    });
    obj.querySelector(".itemAppendQueue").addEventListener("click", (e) => {
      Q.append(e.currentTarget.parentNode.parentNode);
    });
  });
};
const appendAlbums = (dest, albums, template = tileAlbumTemplate) => {
  albums.forEach((album, i) => {
    let obj = template.content.cloneNode(true);
    // listCount++
    obj.querySelector(".title").innerText = album.title;
    obj.querySelector(".artists").innerText = album.artists
      .map((a) => a.name)
      .join(", ");
    obj.querySelector(".link").href = `//mt5577:3000/api/album/${
      album.id
    }/${encodeURI(album.title)}`;

    dest.append(obj);

    // obj.querySelector('.country').innerText = (
    obj = dest.lastElementChild; // need to reassign before setAttribute() since obj was a document-fragment
    if (album.countries)
      obj.setAttribute(
        "data-countries",
        Array.isArray(album.countries)
          ? album.countries.join(", ")
          : album.countries
      );

    let style = obj.getAttribute("style") || "";
    obj.setAttribute(
      "style",
      `background-image:url("/albumart/${album.id}.jpg");${style}`
    );
  });
};

const toggleTileDetails = (e) => {};

const setInnerText = (obj, query, innerText) => {
  const tag = obj.querySelector(query);
  if (tag) tag.innerText = innerText;
};
const buildCollection = (collection, template) => {
  let obj = template.content.cloneNode(true);
  let artists = collection.artists;

  if (!artists) {
    let artistSet = {};
    collection.items.forEach((i) => {
      i.artists.forEach((a) => {
        artistSet[a.id] = a;
      });
    });
    artists = Object.values(artistSet);
  }
  artists =
    artists.length > 1
      ? "various"
      : artists.map((a) => makeA(a, "artist")).join(", ");

  obj.querySelector(".title").innerText = collection.title;
  obj.querySelector(".artists").innerHTML = artists;
  appendItems(
    obj.querySelector(".items"),
    collection.items,
    artists !== "various"
  );

  return obj;
};
const buildAlbum = (album, template) => {
  let obj = buildCollection(album, template);

  let released = album.released ? new Date(album.released) : "";
  released = album.released ? released.getUTCFullYear() : "";

  setInnerText(obj, ".released", released);
  setInnerText(
    obj,
    ".countries",
    album.countries ? album.countries.map((c) => c.name).join(", ") : ""
  );

  return obj;
};

const resizeTiles = (dest) => {
  const widthContainer = dest.clientWidth;
  let widthRunning = 0;
  let tileIndexes = [];
  let doShift = false;
  for (let i = 0; i <= dest.children.length; i++) {
    const e = dest.children[i];
    if (!e || (e.tagName === "DIV" && e.className === "contents")) {
      tileIndexes.push(i);
      if (doShift) {
        let prev = e;
        while (tileIndexes.length > 0) {
          const n = tileIndexes.pop();
          const f = dest.children[n];
          dest.insertBefore(f, prev);
          prev = f;
        }
        // tileIndexes.push(prev);
        widthRunning -= widthContainer;
        doShift = false;
      }
    } else if (e.tagName === "A") {
      widthRunning += e.offsetWidth;
      if (widthRunning >= widthContainer) doShift = true;
    }
  }
};

const appendAlbumTile = (dest, collection, template = tileAlbumTemplate) => {
  // let a = dest.querySelector(`a[href*="${album.id}"]`); // get the related A
  let a = document.querySelector(`a[href*="${collection.id}"]`); // get the related A
  if (!a) return; // if no A for this album, nothing else to do here

  let type = a.pathname.split("/", 2)[1]; // ie., "album" or "artist" or "playlist"
  let obj = buildAlbum(collection, template);

  dest.append(obj);
  obj = dest.lastElementChild; // need to reassign before setAttribute() since obj was a document-fragment
  // obj.insertAdjacentHTML("afterbegin", closeButtonHTML);

  // let siblings = obj.parentElement.children;
  // let d = siblings[siblings.length - 2]; // get the DIV
  let d = obj;
  // let uid = `album-${album.id}`;
  let uid = `${type}-${collection.id}`;
  // lastDiv.setAttribute('data-id', uid)
  d.setAttribute("id", uid);
  d.setAttribute("data-id", uid);

  let artwork = d.querySelector(`.${type}art`);
  if (artwork)
    artwork.style.setProperty(
      "background-image",
      `url(/${type}art/${collection.id}.jpg)`
    );

  obj.querySelector(".contentsAppendQueue").addEventListener("click", (e) => {
    Q.append(
      e.currentTarget.parentElement.parentElement.querySelector(".items")
        .children
    );
  });

  // a.href = `#album-${album.id}`;
  const hideTile = (e) => {
    if (e) {
      e.preventDefault();
      // window.removeEventListener("resize", resizeTile);
    }

    // hide the panel
    let cl = dest.querySelector(`#${type}-${collection.id}`).classList;
    cl.remove("visible");
  };
  const showTile = (e) => {
    if (e) {
      e.preventDefault();

      // re-position Tile if Window is resized
      // window.addEventListener("resize", resizeTile);
    }

    let d = dest.querySelector(`#${type}-${collection.id}`);

    // determine these dimensions on the event handler in case the window dimensions have changed
    // d.style.setProperty("top", `${a.offsetTop - dest.offsetHeight}px`);

    // show the panel
    d.classList.add("visible");
  };
  let tileTimeout = false;
  const tileDelay = 250;
  const resizeTile = (e) => {
    // clear the timeout
    clearTimeout(tileTimeout);
    // start timing for event "completion"
    tileTimeout = setTimeout((e) => {
      hideTile(e);
      showTile(e);
    }, tileDelay);
  };

  a.addEventListener("click", showTile);
  d.querySelector(".contents-close").addEventListener("click", hideTile);
};
const appendAlbumTiles = (dest, albums, template) => {
  albums.forEach((album, i) => {
    appendAlbumTile(dest, album, template);
  });
};

const insertAfter = (refNode, newNode) => {
  refNode.parentNode.insertBefore(newNode, refNode.nextSibling);
};
const duplicateNode = (refNode, newType) => {
  let newNode = document.createElement(newType);
  newNode.attributes = refNode.attributes;
  newNode.classlist += " hidden";
  newNode.innerText = refNode.innerText;
  insertAfter(refNode, newNode);
};

const clearList = () => {
  while (list.firstChild) {
    list.removeChild(list.firstChild);
    listCount--;
  }
};

// appendAlbumTiles(
//   tileContainer,
//   initialTiles
//   // document.getElementById("tile-album-template")
// );
