/**
 * Fetches the given URL, parses the received media file, and returns an object with the extracted metadata.
 * The return object can be used as input for _populate().
 * @param {string} [url] The URL endpoint/file to fetch and parse. Only works if the result is a media file with metadata.
 * @private
 * @returns {ItemSourceData}
 */
const parseAmplfr = async (url, files = true) => {
  let response;
  let obj;

  try {
    response = await fetch(url);
    if (response.ok && !!response.body)
      obj = await response.json();
  } catch (err) {
    console.warn(`Problem fetch'ing '${url}' - ${err.message || err}`)
    return null
  }

  const id = obj.id;
  const items = obj.items
  const name = obj.name
  const origin = url?.origin || (new URL(url)).origin  // if we make it here, url should convert to valid URL()

  obj = {
    id,
    title: obj.title,
    album: obj.album,
    artists: obj.artists,
    artwork: "/albumart/" + (obj?.album?.id || `item/${id}`) + ".jpg",
    // url: obj.url || url, // ensure URL is included
    url,
  };

  if (!!items && Array.isArray(items)) obj.items = items
  if (!!name && name.length > 0) obj.name = name

  /**
   * Adds a nicely formatted obj.href based on obj.url, but without the "/api" or ".json"
   * @param {Object} obj
   * @returns obj (with the HREF set)
   */
  const appendHREF = (obj) => {
    if (Array.isArray(obj))
      return obj.forEach((e) => appendHREF(e));

    // insert in HREF based on the URL, without "/api" and ".json"
    let href = obj?.url || "";
    if (!href || href == "")
      return;

    // remove "/api" and ".json"
    href = href.replace(/\/api|\.json$/g, "");

    const encodedTitle = encodeURI(obj.title || obj.name).replace("%20", "+");
    if (!href.endsWith(encodedTitle))
      href += `/${encodedTitle}`;

    obj.href = href;
  };

  appendHREF(obj);
  appendHREF(obj.album);
  appendHREF(obj.artists);

  // get the list of media files
  files = obj.src || obj.files || !files;
  if (!files) obj = await fetchSrc(obj)

  return obj;
};

const fetchSrc = async (obj) => {
  const id = obj.id;
  // const url = obj.url || `/api/${id}`
  const url = obj.url || '/api/'
  let response;

  let files = obj.src || obj.files;
  // if (files != undefined) {
  if (!files) {
    // if files isn't provided, fetch() it
    response = await fetch(`/api/${id}.files`)
    if (response.ok && !!response.body)
      files = await response.json();
  }

  if (!!files) {
    const media = document.createElement("video");
    obj.src = files
      // return the list media that client might be able to play
      .filter((f) => media.canPlayType(f.mime || f) !== "") // skip anything client can't play
      .map((f) => {
        // f.src = url.substring(0, url.lastIndexOf(".", -8)).replace(id, f.filename); // use f.filename to set the correct src
        f.src = url.substring(0, url.lastIndexOf("/") + 1) + f.filename; // use f.filename to set the correct src
        return f;
      })
      .sort((a, b) => {
        // prefer media files that are playable by client
        const map = {
          probably: 1,
          maybe: 2,
          "": 3, // no chance
        };

        if (map[a] < map[b])
          return -1; // a < b
        else if (map[a] > map[b])
          return 1; // a > b
        else
          return 0; // a = b
      });
  }

  return obj;
};

// export default await parseAmplfr
export {
  parseAmplfr,
  fetchSrc,
}
