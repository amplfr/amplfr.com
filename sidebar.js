const sidebar = document.querySelector('#sidebar')
sidebar.isClosed = () => {
    return Object.values(sidebar.classList).includes('closed')
}

const queueButton = document.querySelector('#headerPlayer')
const sidebarToggle = (e) => {
    e.preventDefault()
    if (sidebar.isClosed()) {
        // open the sidebar and scroll to the Queue
        sidebar.classList.remove('closed')
        sidebar.querySelector('#queuelist').scrollIntoView()
    } else sidebar.classList.add('closed')
    searchbar.classList.toggle('narrow')
    queueButton.classList.toggle('selected')
}
queueButton.addEventListener('click', sidebarToggle)
queueButton.addEventListener('touchend', sidebarToggle)
