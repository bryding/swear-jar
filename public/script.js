class SwearJarApp {
    constructor() {
        this.benButton = document.getElementById('benButton');
        this.kaitiButton = document.getElementById('kaitiButton');
        this.payoutButton = document.getElementById('payoutButton');
        this.benCount = document.getElementById('benCount');
        this.kaitiCount = document.getElementById('kaitiCount');
        this.loading = document.getElementById('loading');
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadCounts();
        
        setInterval(() => {
            this.loadCounts();
        }, 5000);
    }

    bindEvents() {
        this.benButton.addEventListener('click', () => this.incrementSwear('ben'));
        this.kaitiButton.addEventListener('click', () => this.incrementSwear('kaiti'));
        this.payoutButton.addEventListener('click', () => this.payout());
    }

    showLoading() {
        this.loading.classList.add('show');
    }

    hideLoading() {
        this.loading.classList.remove('show');
    }

    async loadCounts() {
        try {
            const response = await fetch('/api/counts');
            if (!response.ok) throw new Error('Failed to load counts');
            
            const data = await response.json();
            this.updateDisplay(data);
        } catch (error) {
            console.error('Error loading counts:', error);
            this.showError('Failed to load counts');
        }
    }

    async incrementSwear(person) {
        this.showLoading();
        
        try {
            const response = await fetch(`/api/swear/${person}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to increment count');
            
            const data = await response.json();
            this.updateDisplay(data);
            this.animateButton(person);
            
        } catch (error) {
            console.error('Error incrementing swear:', error);
            this.showError('Failed to update count');
        } finally {
            this.hideLoading();
        }
    }

    async payout() {
        if (!confirm('Are you sure you want to reset both jar counts to zero?')) {
            return;
        }

        this.showLoading();
        
        try {
            const response = await fetch('/api/payout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to reset counts');
            
            const data = await response.json();
            this.updateDisplay(data);
            this.celebratePayout();
            
        } catch (error) {
            console.error('Error resetting counts:', error);
            this.showError('Failed to reset counts');
        } finally {
            this.hideLoading();
        }
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
        setTimeout(() => {
            button.style.transform = '';
        }, 100);
    }

    celebratePayout() {
        this.payoutButton.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)';
        
        setTimeout(() => {
            this.payoutButton.style.background = 'linear-gradient(135deg, #48c6ef 0%, #6f86d6 100%)';
        }, 1000);

        const celebration = document.createElement('div');
        celebration.innerHTML = '🎉';
        celebration.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 4rem;
            pointer-events: none;
            animation: celebrate 1s ease-out forwards;
            z-index: 1001;
        `;

        const style = document.createElement('style');
        style.textContent = `
            @keyframes celebrate {
                0% { 
                    opacity: 0; 
                    transform: translate(-50%, -50%) scale(0.5); 
                }
                50% { 
                    opacity: 1; 
                    transform: translate(-50%, -50%) scale(1.2); 
                }
                100% { 
                    opacity: 0; 
                    transform: translate(-50%, -50%) scale(1) translateY(-50px); 
                }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(celebration);
        
        setTimeout(() => {
            document.body.removeChild(celebration);
            document.head.removeChild(style);
        }, 1000);
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #ff4757;
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            font-weight: 600;
            z-index: 1002;
            box-shadow: 0 4px 12px rgba(255, 71, 87, 0.3);
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (document.body.contains(errorDiv)) {
                document.body.removeChild(errorDiv);
            }
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SwearJarApp();
});