// Frontend test setup with JSDOM
// Add TextEncoder/TextDecoder polyfill for Node.js environment
const { TextEncoder, TextDecoder } = require('util');
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}

// Setup JSDOM manually for better control
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable',
  runScripts: 'dangerously'
});

// Set globals
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Event = dom.window.Event;
global.KeyboardEvent = dom.window.KeyboardEvent;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
global.localStorage = localStorageMock;

// Mock fetch API
global.fetch = jest.fn();

// Mock DOM elements and methods
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Helper to create DOM elements for testing
global.createMockDOM = () => {
  document.body.innerHTML = `
    <div class="auth-screen" id="authScreen">
      <div class="auth-content">
        <h1 class="auth-title">🫙 Swear Jar</h1>
        <div class="auth-form">
          <p class="auth-message">Enter PIN to access the jar</p>
          <div class="pin-input-container">
            <input type="tel" class="pin-digit" id="digit0" maxlength="1" autocomplete="off">
            <input type="tel" class="pin-digit" id="digit1" maxlength="1" autocomplete="off">
            <input type="tel" class="pin-digit" id="digit2" maxlength="1" autocomplete="off">
            <input type="tel" class="pin-digit" id="digit3" maxlength="1" autocomplete="off">
            <input type="tel" class="pin-digit" id="digit4" maxlength="1" autocomplete="off">
          </div>
          <div class="auth-error" id="authError"></div>
        </div>
      </div>
    </div>

    <div class="connection-screen" id="connectionScreen">
      <div class="connection-content">
        <div class="connection-status" id="connectionStatus">
          <p id="connectionMessage">Connecting...</p>
        </div>
        <div class="connection-details" id="connectionDetails"></div>
      </div>
    </div>

    <div class="error-modal" id="errorModal">
      <div class="error-content">
        <p id="errorMessage"></p>
        <div class="error-details" id="errorDetails"></div>
        <button class="retry-button" id="retryButton">Retry</button>
      </div>
    </div>

    <div class="container" id="appContainer" style="display: none;">
      <header class="header">
        <h1 class="title">🫙 Swear Jar</h1>
      </header>

      <main class="main-buttons">
        <button class="swear-button ben-button" id="benButton" data-person="ben">
          <div class="button-content">
            <img src="images/ben.jpg" alt="Ben" class="profile-pic">
            <span class="name">Ben</span>
            <span class="count" id="benCount">0</span>
          </div>
        </button>
        
        <button class="swear-button kaiti-button" id="kaitiButton" data-person="kaiti">
          <div class="button-content">
            <img src="images/kaiti.jpg" alt="Kaiti" class="profile-pic">
            <span class="name">Kaiti</span>
            <span class="count" id="kaitiCount">0</span>
          </div>
        </button>
      </main>

      <footer class="footer">
        <button class="payout-button" id="payoutButton">
          <span>💰 Payout & Reset</span>
          <span class="payout-total" id="payoutTotal">$0</span>
        </button>
      </footer>
    </div>
  `;
};

// Mock CSS classes and animations
global.mockCSS = {
  addClass: jest.fn(),
  removeClass: jest.fn(),
  hasClass: jest.fn(() => false)
};

// Extend Element prototype for easier testing
if (typeof Element !== 'undefined') {
  Element.prototype.addClass = function(className) {
    this.classList.add(className);
    global.mockCSS.addClass(className);
  };

  Element.prototype.removeClass = function(className) {
    this.classList.remove(className);
    global.mockCSS.removeClass(className);
  };
}

// Helper to simulate events
global.fireEvent = (element, eventType, eventData = {}) => {
  const event = new Event(eventType, { bubbles: true });
  Object.keys(eventData).forEach(key => {
    event[key] = eventData[key];
  });
  element.dispatchEvent(event);
};

// Helper to simulate keyboard events
global.fireKeyboardEvent = (element, eventType, key, eventData = {}) => {
  const event = new KeyboardEvent(eventType, { 
    key, 
    bubbles: true, 
    cancelable: true,
    ...eventData 
  });
  element.dispatchEvent(event);
};

// Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.getItem.mockReturnValue(null);
  fetch.mockClear();
  global.mockCSS.addClass.mockClear();
  global.mockCSS.removeClass.mockClear();
});

