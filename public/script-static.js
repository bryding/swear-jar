class SwearJarApp {
    constructor() {
        this.benButton = document.getElementById('benButton');
        this.kaitiButton = document.getElementById('kaitiButton');
        this.payoutButton = document.getElementById('payoutButton');
        this.benCount = document.getElementById('benCount');
        this.kaitiCount = document.getElementById('kaitiCount');
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadCounts();
    }

    bindEvents() {
        this.benButton.addEventListener('click', () => this.incrementSwear('ben'));
        this.kaitiButton.addEventListener('click', () => this.incrementSwear('kaiti'));
        this.payoutButton.addEventListener('click', () => this.payout());
    }

    loadCounts() {
        const data = this.getData();
        this.updateDisplay(data);
    }

    getData() {
        const stored = localStorage.getItem('swearJarData');
        return stored ? JSON.parse(stored) : { ben: 0, kaiti: 0 };
    }

    saveData(data) {
        localStorage.setItem('swearJarData', JSON.stringify(data));
    }

    incrementSwear(person) {
        const data = this.getData();
        data[person] += 1;
        this.saveData(data);
        this.updateDisplay(data);
        this.animateButton(person);
    }

    payout() {
        if (!confirm('Reset both jar counts to zero?')) return;
        
        const data = { ben: 0, kaiti: 0 };
        this.saveData(data);
        this.updateDisplay(data);
        this.celebratePayout();
    }

    updateDisplay(data) {
        this.animateCountUpdate(this.benCount, data.ben);
        this.animateCountUpdate(this.kaitiCount, data.kaiti);
    }

    animateCountUpdate(element, newValue) {
        element.classList.add('updating');
        setTimeout(() => {
            element.textContent = newValue;
            element.classList.remove('updating');
        }, 150);
    }

    animateButton(person) {
        const button = person === 'ben' ? this.benButton : this.kaitiButton;
        button.style.transform = 'scale(0.95)';
        setTimeout(() => { button.style.transform = ''; }, 100);
    }

    celebratePayout() {
        this.payoutButton.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)';
        setTimeout(() => {
            this.payoutButton.style.background = 'linear-gradient(135deg, #48c6ef 0%, #6f86d6 100%)';
        }, 1000);
    }
}

document.addEventListener('DOMContentLoaded', () => new SwearJarApp());