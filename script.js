const API_KEY = "3b8e578f3f8a51acee409495fcc8654a";

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function getDefaultSearchTerm() {
    const page = window.location.pathname.split('/').pop();
    const pageMap = {
        'world.html': 'world',
        'politics.html': 'politics',
        'business.html': 'business',
        'technology.html': 'technology',
        'sports.html': 'India sports',
        'entertainment.html': 'entertainment'
    };
    return pageMap[page] || 'india';
}

function saveSearchQuery(query) {
    localStorage.setItem('lastSearchQuery', query);
    localStorage.setItem('lastSearchPage', window.location.pathname);
}

function getSavedSearchQuery() {
    const savedPage = localStorage.getItem('lastSearchPage');
    const savedQuery = localStorage.getItem('lastSearchQuery');
    
    if (savedPage === window.location.pathname && savedQuery) {
        return savedQuery;
    }
    return null;
}

function clearSavedSearch() {
    localStorage.removeItem('lastSearchQuery');
    localStorage.removeItem('lastSearchPage');
}

window.addEventListener('load', () => {
    const searchInput = document.querySelector('input.search');
    
    setupListViewButtons();
    
    const savedQuery = getSavedSearchQuery();
    
    if (savedQuery) {
        if (searchInput) {
            searchInput.value = savedQuery;
        }
        fetchNews(savedQuery);
    } else {
        fetchNews(getDefaultSearchTerm());
    }

    if (searchInput) {
        const debouncedSearch = debounce(function(query) {
            if (query.trim()) {
                searchInput.classList.add('searching');
                saveSearchQuery(query);
                fetchNews(query).finally(() => {
                    searchInput.classList.remove('searching');
                });
            }
        }, 500);

        searchInput.addEventListener('input', function(event) {
            const query = event.target.value.trim();
            if (query.length >= 2) {
                debouncedSearch(query);
            } else if (query.length === 0) {
                searchInput.classList.add('searching');
                clearSavedSearch(); 
                fetchNews(getDefaultSearchTerm()).finally(() => {
                    searchInput.classList.remove('searching');
                });
            }
        });

        searchInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                const query = searchInput.value.trim();
                if (query) {
                    searchInput.classList.add('searching');
                    saveSearchQuery(query);
                    fetchNews(query).finally(() => {
                        searchInput.classList.remove('searching');
                    });
                }
            }
        });
    }
});

function setupListViewButtons() {
    const likedBtn = document.getElementById('liked-btn');
    const dislikedBtn = document.getElementById('disliked-btn');
    const favoritesBtn = document.getElementById('favorites-btn');
    
    likedBtn.addEventListener('click', () => showUserList('liked'));
    dislikedBtn.addEventListener('click', () => showUserList('disliked'));
    favoritesBtn.addEventListener('click', () => showUserList('favorites'));
    updateListCounts();
}

function updateListCounts() {
    const likedCount = getUserListArticles('liked').length;
    const dislikedCount = getUserListArticles('disliked').length;
    const favoritesCount = getUserListArticles('favorites').length;
    
    document.getElementById('liked-btn').textContent = `👍 Liked (${likedCount})`;
    document.getElementById('disliked-btn').textContent = `👎 Disliked (${dislikedCount})`;
    document.getElementById('favorites-btn').textContent = `⭐ Favorites (${favoritesCount})`;
}

function backToNews() {
    document.querySelectorAll('.list-btn').forEach(btn => btn.classList.remove('active'));
    const searchInput = document.querySelector('input.search');
    if (searchInput) {
        searchInput.value = '';
    }
    clearSavedSearch();
    fetchNews(getDefaultSearchTerm());
}

function showUserList(listType) {
    document.querySelectorAll('.list-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${listType}-btn`).classList.add('active');
    const searchInput = document.querySelector('input.search');
    if (searchInput) {
        searchInput.value = '';
    }
    const articles = getUserListArticles(listType);
    if (articles.length === 0) {
        const cardContainer = document.getElementById('card-container');
        cardContainer.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <h2>No ${listType} articles yet</h2>
                <p>Start browsing news and ${listType === 'favorites' ? 'favorite' : listType} some articles to see them here!</p>
                <button class="list-btn" onclick="backToNews()" style="margin-top: 20px;">← Back to News</button>
            </div>
        `;
        return;
    }
    bindData(articles);
}

function getUserListArticles(listType) {
    const articles = [];
    const keys = Object.keys(localStorage);
    
    keys.forEach(key => {
        if (key.startsWith('article_')) {
            try {
                const state = JSON.parse(localStorage.getItem(key));
                const shouldInclude = listType === 'liked' ? state.userLiked : 
                                   listType === 'disliked' ? state.userDisliked : 
                                   listType === 'favorites' ? state.userFavorited : false;
                
                if (shouldInclude) {
                    const articleData = getArticleDataFromKey(key);
                    if (articleData) {
                        articles.push(articleData);
                    }
                }
            } catch (error) {
                // Silently skip invalid entries
            }
        }
    });
    
    return articles;
}

function getArticleDataFromKey(key) {
    try {
        const savedData = JSON.parse(localStorage.getItem(key));
        
        if (savedData && savedData.articleData) {
            return savedData.articleData;
        }
        
        const articleId = key.replace('article_', '');
        return {
            title: `Article ${articleId.substring(0, 8)}...`,
            description: `This is a saved article.`,
            source: { name: 'Saved Article' },
            publishedAt: new Date().toISOString(),
            url: '#',
            image: 'https://via.placeholder.com/300x200?text=Saved+Article'
        };
    } catch (error) {
        return null;
    }
}

async function fetchNews(query) {
    try {
        let apiUrl = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&token=${API_KEY}&lang=en&max=10`;
        let res = await fetch(apiUrl);
        
        if (!res.ok) {
            apiUrl = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&apiKey=${API_KEY}&lang=en&max=10`;
            res = await fetch(apiUrl);
            
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
        }
        
        const data = await res.json();
        
        if (data.articles && Array.isArray(data.articles)) {
            bindData(data.articles);
        } else {
            bindData([]);
        }
    } catch (error) {
        bindData([]);
    }
}

function bindData(articles) {
    const cardContainer = document.getElementById('card-container');
    const newsCardTemplate = document.getElementById('news-card-template');

    if (!cardContainer || !newsCardTemplate) {
        return;
    }

    cardContainer.innerHTML = "";

    if (!articles || articles.length === 0) {
        cardContainer.innerHTML = '<p style="text-align: center; padding: 20px;">No news articles found.</p>';
        return;
    }

    articles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    articles.forEach(article => {
        if (!article.image && !article.urlToImage) {
            return;
        }
        
        try {
            const cardClone = newsCardTemplate.cloneNode(true);
            cardClone.style.display = "block";
            fillDataInCard(cardClone, article);
            cardContainer.appendChild(cardClone);
        } catch (error) {
            // Skip problematic articles
        }
    });
}

function fillDataInCard(cardClone, article) {
        const imageUrl = article.image || article.urlToImage;
        cardClone.querySelector('#news-img').src = imageUrl;
        cardClone.querySelector('#news-title').innerHTML = article.title;
        cardClone.querySelector('#news-desc').innerHTML = article.description;
        
        const sourceName = article.source?.name || article.source || 'Unknown Source';
        const publishDate = new Date(article.publishedAt).toLocaleString("en-US", { timeZone: "Asia/kolkata" });
        cardClone.querySelector('#news-source').innerHTML = sourceName + " • " + publishDate;
        cardClone.querySelector('#news-link').href = article.url;
        
            setupActionButtons(cardClone, article);
}

function setupActionButtons(cardClone, article) {
        const articleId = generateArticleId(article);
        const likeBtn = cardClone.querySelector('.like-btn');
        const dislikeBtn = cardClone.querySelector('.dislike-btn');
        const favoriteBtn = cardClone.querySelector('.favorite-btn');
        
        if (!likeBtn || !dislikeBtn || !favoriteBtn) {
            return;
        }
        
        const savedState = getArticleState(articleId);
        
        updateButtonState(likeBtn, savedState.likes, savedState.userLiked);
        updateButtonState(dislikeBtn, savedState.dislikes, savedState.userDisliked);
        updateButtonState(favoriteBtn, null, savedState.userFavorited);
        
        likeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleAction(articleId, 'like', likeBtn, dislikeBtn, article);
        });
        dislikeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleAction(articleId, 'dislike', dislikeBtn, likeBtn, article);
        });
        favoriteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleAction(articleId, 'favorite', favoriteBtn, null, article);
        });
}

function generateArticleId(article) {
        const title = article.title || '';
        const source = article.source?.name || article.source || '';
        const combined = title + source;
        return btoa(encodeURIComponent(combined)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
}

function getArticleState(articleId) {
    const saved = localStorage.getItem(`article_${articleId}`);
    return saved ? JSON.parse(saved) : {
        likes: 0,
        dislikes: 0,
        userLiked: false,
        userDisliked: false,
        userFavorited: false
    };
}

function saveArticleState(articleId, state, articleData = null) {
    const dataToSave = {
        ...state,
        articleData: articleData
    };
    localStorage.setItem(`article_${articleId}`, JSON.stringify(dataToSave));
}

function updateButtonState(button, count, isActive) {
    if (count !== null) {
        button.querySelector('.count').textContent = count;
    }
    
    if (isActive) {
        button.classList.add('active');
    } else {
        button.classList.remove('active');
    }
}

function handleAction(articleId, action, primaryBtn, secondaryBtn = null, articleData = null) {
    const state = getArticleState(articleId);
    
    switch (action) {
        case 'like':
            if (state.userLiked) {
                state.likes--;
                state.userLiked = false;
            } else {
                state.likes++;
                state.userLiked = true;
                if (state.userDisliked) {
                    state.dislikes--;
                    state.userDisliked = false;
                    if (secondaryBtn) {
                        updateButtonState(secondaryBtn, state.dislikes, false);
                    }
                }
            }
            break;
            
        case 'dislike':
            if (state.userDisliked) {
                state.dislikes--;
                state.userDisliked = false;
            } else {
                state.dislikes++;
                state.userDisliked = true;
                if (state.userLiked) {
                    state.likes--;
                    state.userLiked = false;
                    if (secondaryBtn) {
                        updateButtonState(secondaryBtn, state.likes, false);
                    }
                }
            }
            break;
            
        case 'favorite':
            state.userFavorited = !state.userFavorited;
            break;
    }
    
    saveArticleState(articleId, state, articleData);
    
    if (action === 'like') {
        updateButtonState(primaryBtn, state.likes, state.userLiked);
    } else if (action === 'dislike') {
        updateButtonState(primaryBtn, state.dislikes, state.userDisliked);
    } else if (action === 'favorite') {
        updateButtonState(primaryBtn, null, state.userFavorited);
    }
    
    updateListCounts();
    showActionFeedback(action, state);
}

function showActionFeedback(action, state) {
    const messages = {
        like: state.userLiked ? 'Liked!' : 'Removed like',
        dislike: state.userDisliked ? 'Disliked!' : 'Removed dislike',
        favorite: state.userFavorited ? 'Added to favorites!' : 'Removed from favorites'
    };
    
    const feedback = document.createElement('div');
    feedback.textContent = messages[action];
    feedback.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #1a237e;
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 6px;
        z-index: 1000;
        font-size: 0.9rem;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(feedback);
    
    setTimeout(() => {
        feedback.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 300);
    }, 2000);
}