const form = document.querySelector('#search-form');
const query = document.querySelector('#query');
const results = document.querySelector('#results');
const hint = document.querySelector('#hint');
const template = document.querySelector('#result-template');
const urlForm = document.querySelector('#url-form');
const directUrl = document.querySelector('#youtube-url');
const directFormat = document.querySelector('#direct-format');
const prevPageBtn = document.querySelector('#prev-page');
const nextPageBtn = document.querySelector('#next-page');
const pageInfo = document.querySelector('#page-info');

const PAGE_SIZE = 20;
let currentPage = 0;
let totalLoaded = 0;
let allItems = [];
let isLoadingPage = false;
let noMoreResults = false;

function setHint(text) {
  hint.textContent = text;
}

function message(text, type = '') {
  results.innerHTML = `<p class="message ${type}">${text}</p>`;
}

function setLoading(isLoading) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = isLoading;
  button.textContent = isLoading ? 'Se caută…' : 'Caută';
}

function updatePagination() {
  const totalPages = totalLoaded > 0 ? Math.ceil(totalLoaded / PAGE_SIZE) : 0;
  pageInfo.textContent = totalLoaded > 0 ? `${currentPage + 1} din ${totalPages}+` : '0 din 0';
  prevPageBtn.disabled = currentPage === 0 || isLoadingPage || totalLoaded === 0;
  // Next button: always enabled if we might have more results (backend can load more)
  // Only disable if we know for sure there are no more (empty searchMore returned)
  nextPageBtn.disabled = isLoadingPage || totalLoaded === 0 || noMoreResults;
}

function renderPage() {
  results.innerHTML = '';
  const start = currentPage * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, totalLoaded);
  for (let i = start; i < end; i++) {
    addResult(allItems[i]);
  }
  updatePagination();
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const text = query.value.trim();
  if (!text) return;

  setLoading(true);
  setHint('Se caută pe YouTube…');
  message('');
  currentPage = 0;
  allItems = [];
  totalLoaded = 0;
  noMoreResults = false;

  try {
    const items = await window.videografiasi.search(text);
    if (!items.length) {
      setHint('Încearcă alt termen de căutare.');
      message('Nu am găsit rezultate.');
      updatePagination();
      return;
    }
    allItems = items;
    totalLoaded = items.length;
    renderPage();
    setHint(`S-au găsit ${totalLoaded} rezultate. Folosește paginarea pentru a naviga.`);
  } catch (error) {
    setHint('Caută pe YouTube');
    message(`Eroare la căutare: ${error.message}`, 'error');
  } finally {
    setLoading(false);
  }
});

nextPageBtn.addEventListener('click', async () => {
  if (isLoadingPage) return;
  const nextStart = (currentPage + 1) * PAGE_SIZE;

  // Need to load more from backend
  if (nextStart >= totalLoaded) {
    isLoadingPage = true;
    nextPageBtn.disabled = true;
    nextPageBtn.textContent = 'Se încarcă…';
    setHint('Se încarcă mai multe rezultate…');

    try {
      const items = await window.videografiasi.searchMore();
      if (items.length) {
        allItems = allItems.concat(items);
        totalLoaded = allItems.length;
        currentPage++;
        renderPage();
        setHint(`Afișare pagina ${currentPage + 1}. Total: ${totalLoaded} rezultate.`);
      } else {
        noMoreResults = true;
        setHint('Nu mai sunt rezultate.');
      }
    } catch (error) {
      setHint('Eroare la încărcare: ' + error.message);
    } finally {
      isLoadingPage = false;
      nextPageBtn.textContent = 'Pagina următoare →';
      updatePagination();
    }
  } else {
    currentPage++;
    renderPage();
    setHint(`Afișare pagina ${currentPage + 1}. Total: ${totalLoaded} rezultate.`);
  }
});

prevPageBtn.addEventListener('click', () => {
  if (currentPage > 0) {
    currentPage--;
    renderPage();
    setHint(`Afișare pagina ${currentPage + 1}. Total: ${totalLoaded} rezultate.`);
  }
});

urlForm.addEventListener('submit', async event => {
  event.preventDefault();
  const url = directUrl.value.trim();
  if (!url) return;

  const button = urlForm.querySelector('button');
  button.disabled = true;
  button.textContent = 'Se descarcă…';
  setHint('Se descarcă linkul direct…');

  try {
    const response = await window.videografiasi.download({ url, format: directFormat.value });
    if (!response.canceled) {
      setHint('Fișierul a fost descărcat și importat în Media Pool.');
      directUrl.value = '';
    } else {
      setHint('Descărcare anulată. Folderul se alege la fiecare download.');
    }
  } catch (error) {
    setHint(error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Download';
  }
});

function addResult(item) {
  const card = template.content.firstElementChild.cloneNode(true);
  const image = card.querySelector('.thumbnail');
  image.src = item.thumbnail;
  image.alt = '';
  card.querySelector('strong').textContent = item.title;
  card.querySelector('small').textContent = [item.channel, item.duration].filter(Boolean).join(' · ');
  card.querySelector('.preview').addEventListener('click', () => playPreview(card, item));

  const button = card.querySelector('.download');
  button.addEventListener('click', async () => {
    button.disabled = true;
    button.classList.remove('error', 'success');
    button.textContent = 'Se descarcă…';
    setHint(`Se descarcă: ${item.title}`);

    try {
      const response = await window.videografiasi.download({ url: item.url, format: card.querySelector('select').value });
      if (!response.canceled) {
        button.textContent = 'Importat';
        button.classList.add('success');
        setHint('Fișierul a fost descărcat și importat în Media Pool.');
      } else {
        button.textContent = 'Download';
        setHint('Descărcare anulată. Folderul se alege la fiecare download.');
      }
    } catch (error) {
      button.textContent = 'Eroare';
      button.classList.add('error');
      setHint(error.message);
    } finally {
      button.disabled = false;
    }
  });

  results.append(card);
}

function playPreview(card, item) {
  document.querySelectorAll('.preview.playing').forEach(button => {
    button.classList.remove('playing');
    const image = button.dataset.thumbnail;
    if (image) {
      button.innerHTML = `<img class="thumbnail" src="${image}" alt=""><span class="play">▶</span>`;
    }
  });

  const preview = card.querySelector('.preview');
  preview.dataset.thumbnail = item.thumbnail;
  preview.classList.add('playing');
  preview.innerHTML = `<iframe title="Previzualizare YouTube" src="https://www.youtube.com/embed/${encodeURIComponent(item.id)}?autoplay=1&controls=1&rel=0&enablejsapi=1" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
}