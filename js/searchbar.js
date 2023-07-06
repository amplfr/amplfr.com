const searchbar = document.querySelector("#searchbar");
searchbar.isClosed = () => {
  return Object.values(searchbar.classList).includes("closed");
};

// const searchButton = document.querySelector("#searchIcon");
const searchButton = document.querySelector("#controls #search");
const searchInput = document.querySelector("#searchinput");
const searchbarToggle = (e) => {
  e.preventDefault();
  if (searchbar.isClosed()) {
    // open the searchbar and scroll to the top of it
    searchbar.classList.remove("closed");
    // searchbar.scrollIntoView()
    searchbar.querySelector("#searchbar");
    searchInput.focus();
  } else {
    searchbar.classList.add("closed");
    searchInput.blur();
  }
  searchButton.classList.toggle("selected");
};
searchButton.addEventListener("click", searchbarToggle);
searchButton.addEventListener("touchend", searchbarToggle);
