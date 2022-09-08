const API = "caches" in self ? caches.open("api") : {};
const list = document.getElementById("list");
const tileContainer = document.getElementById("recommended");
const albumTemplate = document.getElementById("list-album-template");
const artistTemplate = document.getElementById("list-artist-template");
const itemTemplate = document.getElementById("list-item-template");

Number.prototype.toMMSS = function () {
  if (Number.isNaN(this.valueOf())) return "";
  let s = Math.round(this % 60),
    m = Math.floor(this / 60);

  if (m >= 60) m = `${m / 60}:${(m % 60).toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

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
    obj.querySelector(".link").href = `//mt5577:3000/api/artist/${
      artist.id
    }/${encodeURI(artist.name)}`;

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
const appendItems = (dest, items, dontShowArtists = false) => {
  items.forEach((item, i) => {
    let obj = itemTemplate.content.cloneNode(true);
    // listCount++
    // obj.querySelector('.number').innerText = i + 1
    obj.querySelector(".title").innerText = item.title;
    obj.querySelector(".duration").innerText = Number(item.duration).toMMSS();
    obj.querySelector(".link").href = `//mt5577:3000/api/${item.id}/${encodeURI(
      item.title
    )}`;
    if (!dontShowArtists)
      //   obj.querySelector(".artists").innerText = (item.artists || item.artist)
      obj.querySelector(".artists").innerHTML = (item.artists || item.artist)
        // .map((a) => a.name)
        // .join(", ");
        .map((a) => makeA(a, "artist"))
        .join(", ");

    dest.append(obj);

    obj = dest.lastElementChild; // need to reassign before setAttribute() since obj was a document-fragment
    obj.setAttribute("data-number", i + 1);
    obj.setAttribute("data-duration", item.duration);
    obj.setAttribute("data-id", item.id);
    // let style = obj.getAttribute('style')
    // obj.setAttribute(
    //     'style',
    //     `background-image:url("/albumart/item/${item.id}.jpg");${style}`
    // )
  });
};
const appendAlbums = (dest, albums, template = albumTemplate) => {
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

const buildAlbum = (album, template) => {
  let dontShowArtists = false;
  let obj = template.content.cloneNode(true);
  let artists = album.artists;

  if (!artists) {
    let artistSet = {};
    album.items.forEach((i) => {
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
  // : album.artists.map((a) => a.name).join(', ')

  if (artists !== "various") dontShowArtists = true;
  let released = album.released ? new Date(album.released) : "";
  released = album.released ? released.getUTCFullYear() : "";
  obj.querySelector(".title").innerText = album.title;
  obj.querySelector(".artists").innerHTML = artists;
  obj.querySelector(".released").innerText = released;
  obj.querySelector(".countries").innerText = album.countries
    ? album.countries.map((c) => c.name).join(", ")
    : "";
  appendItems(obj.querySelector(".items"), album.items, dontShowArtists);

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

const appendAlbumTiles = (dest, albums, template = albumTemplate) => {
  const maxTiles = 36;
  // get the number of existing generated/static tiles
  let tileCounter =
    dest.querySelectorAll(".tile").length > 0
      ? Object.values(dest.querySelectorAll(".tile"))
          .map((t) => 1 * t.dataset["tiles"] || 1)
          .reduce((acc, t) => acc + t)
      : 0;
  let multiplier = Math.max(
    Math.floor((tileCounter + albums.length) / maxTiles),
    1
  );
  const randomIntFromInterval = (min, max) => {
    // https://stackoverflow.com/a/7228322
    return Math.floor(Math.random() * (max - min + 1) + min);
  };
  const maxTilesInARow = 9;
  // prime numbers (except for 1, 2, 3)
  const pseudoPrimes = [5, 7, 11, 13, 17, 19, 23, 25, 29, 31, 35].filter(
    (i) => i > tileCounter && i < maxTiles - tileCounter - maxTilesInARow
  );
  // choose a tile ("prime") index to be enlarged and floated right
  let tile2x2 =
    // tileCounter +
    pseudoPrimes[randomIntFromInterval(0, pseudoPrimes.length - 1)];

  albums.forEach((album, i) => {
    if (tileCounter >= maxTiles * multiplier) return; // don't make more tiles than will fit properly

    // let dontShowArtists = false;
    // let obj = template.content.cloneNode(true);
    // let artists =
    //   album.artists.length > 1
    //     ? "various"
    //     : album.artists.map((a) => makeA(a, "artist")).join(", ");
    // // : album.artists.map((a) => a.name).join(', ')
    // if (artists !== "various") dontShowArtists = true;
    // let released = album.released ? new Date(album.released) : "";
    // released = album.released ? released.getUTCFullYear() : "";
    // obj.querySelector(".title").innerText = album.title;
    // obj.querySelector(".artist").innerHTML = artists;
    // obj.querySelector(".released").innerText = released;
    // obj.querySelector(".countries").innerText = album.countries
    //   ? album.countries.map((c) => c.name).join(", ")
    //   : "";
    // appendItems(obj.querySelector(".items"), album.items, dontShowArtists);
    let obj = buildAlbum(album, template);

    dest.append(obj);
    obj = dest.lastElementChild; // need to reassign before setAttribute() since obj was a document-fragment

    let siblings = obj.parentElement.children;
    let d = siblings[siblings.length - 2]; // get the DIV
    let uid = `album-${album.id}`;
    // lastDiv.setAttribute('data-id', uid)
    d.setAttribute("id", uid);
    d.setAttribute("data-id", uid);

    let albumart = d.querySelector(".albumart");
    albumart.style.setProperty(
      "background-image",
      `url(/albumart/${album.id}.jpg)`
    );

    let items = album.items.length;
    // if there are a lot of items, make sure there are 2 columns
    if (album.items.length > 30) {
      items = Math.ceil(items / 2);
      d.querySelector(".items").style.setProperty(
        "grid-template-rows",
        "repeat(" + items + ", auto)"
      );
    }

    // let h = 0
    // let lastDivChildren = lastDiv.querySelectorAll('div')
    // lastDivChildren.forEach((i) => {
    //     console.log(`${i}: ${i.clientHeight}`)
    //     h += i.clientHeight
    // })
    // h = Math.max(Math.ceil((h + items * 18) / 200) * 200, 600)
    // lastDiv.style.setProperty('height', `${h}px`)

    obj.href = `//mt5577:3000/api/album/${album.id}/${encodeURI(album.title)}`;
    obj.style.setProperty(
      "background-image",
      `url("/albumart/${album.id}.jpg")`
    );
    obj.classList.add("tile-link");
    obj.addEventListener("click", (e) => {
      e.preventDefault();
      let d = dest.querySelector(`#${`album-${album.id}`}`);
      let cc = d.querySelector(".contents-close");

      // determine these dimensions on the event handler in case the window dimensions have changed
      let tileSide = Math.min(200, window.innerWidth / 2);
      let row = Math.floor(e.target.offsetTop / tileSide); // which row's top should this line up with
      //   d.style.setProperty(
      //     "margin-top",
      //     `${row * tileSide + tileSide}px`,
      //     "important"
      //   );

      // show the panel
      d.classList.add("visible");
      d.classList.remove("hidden");
      // window.scrollTo(0, row * tileSide)
      cc.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    d.querySelector(".contents-close").addEventListener("click", (e) => {
      e.preventDefault();
      // hide the panel
      let cl = dest.querySelector(`#${`album-${album.id}`}`).classList;
      cl.add("hidden");
      cl.remove("visible");
    });

    tileCounter++;
    if (tileCounter == tile2x2) {
      // shouldn't get here if (i >= maxTiles or multiplier > 1)
      obj.classList.add("tile2x2"); // make this one larger
      tileCounter += 3;
    }
  });

  resizeTiles(dest);
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
document.querySelectorAll("a.api-link").forEach((a) => {
  // duplicateNode(a, 'span')
  a.addEventListener("click", async (e) => {
    e.preventDefault(); // don't follow the link
    let href = a.getAttribute("href");
    if (href.includes(":")) {
      let link = new URL(href);
      if (link.hostname && link.hostname !== location.hostname) return true;
    }
    let response = await fetch(`${location.href}api${href}.json`);
    let rv = await response.json();

    appendItems(list, rv.items);
  });
});

const clearList = () => {
  while (list.firstChild) {
    list.removeChild(list.firstChild);
    listCount--;
  }
};
// document.getElementById('search').onsubmit = async (e) => {
const searchSubmit = async (e) => {
  e.preventDefault();
  const baseURL = e.submitter.formAction;
  const type = e.submitter.defaultValue;
  let query = [];
  for (let i = 0; i < e.target.length; i++)
    // if (e.target[i].type == 'text')
    if (e.target[i].type == "text" || e.target[i].type == "search")
      query.push(`${e.target[i].name}=${e.target[i].value}`);

  document.body.style.cursor = "wait";
  let response = await fetch(`${baseURL}?${query.join("&")}`);
  let rv = await response.json();

  clearList();
  switch (type) {
    case "Artist":
      appendArtists(list, rv);
      break;
    case "Album":
    case "Playlist":
      appendAlbums(list, rv);
      break;
    case "Item":
    default:
      appendItems(list, rv);
      break;
  }
  document.body.style.cursor = "default";

  return false;
};
document.getElementById("searchform").addEventListener("submit", searchSubmit);
