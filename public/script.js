class SwearJarApp {
    constructor() {
        this.connectionScreen = document.getElementById('connectionScreen');
        this.connectionMessage = document.getElementById('connectionMessage');
        this.connectionDetails = document.getElementById('connectionDetails');
        this.appContainer = document.getElementById('appContainer');
        this.errorModal = document.getElementById('errorModal');
        this.errorMessage = document.getElementById('errorMessage');
        this.errorDetails = document.getElementById('errorDetails');
        this.retryButton = document.getElementById('retryButton');
        
        this.benButton = document.getElementById('benButton');
        this.kaitiButton = document.getElementById('kaitiButton');
        this.payoutButton = document.getElementById('payoutButton');
        this.benCount = document.getElementById('benCount');
        this.kaitiCount = document.getElementById('kaitiCount');
        this.payoutTotal = document.getElementById('payoutTotal');
        
        this.databaseConnected = false;
        this.connectionLog = [];
        
        this.init();
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
        console.log(`🫙 ${logEntry}`);
        
        this.connectionLog.push(logEntry);
        this.updateConnectionDetails();
        
        // Update connection message
        if (type === 'error') {
            this.connectionMessage.textContent = message;
            this.connectionMessage.style.color = '#ff6b6b';
        } else if (type === 'success') {
            this.connectionMessage.textContent = message;
            this.connectionMessage.style.color = '#51cf66';
        } else {
            this.connectionMessage.textContent = message;
            this.connectionMessage.style.color = 'white';
        }
    }

    updateConnectionDetails() {
        if (this.connectionDetails) {
            this.connectionDetails.textContent = this.connectionLog.slice(-10).join('\n');
            this.connectionDetails.scrollTop = this.connectionDetails.scrollHeight;
        }
    }

    async init() {
        this.log('Frontend app starting...');
        this.log('Checking database connection...');
        
        this.retryButton.addEventListener('click', () => this.retryConnection());
        
        await this.checkDatabaseConnection();
        
        if (this.databaseConnected) {
            this.enableApp();
        } else {
            this.showConnectionError();
        }
    }

    async checkDatabaseConnection() {
        const maxRetries = 3;
        const retryDelay = 2000;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                this.log(`Database connection attempt ${attempt}/${maxRetries}...`);
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                
                const response = await fetch('/api/status', {
                    method: 'GET',
                    signal: controller.signal,
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Content-Type': 'application/json'
                    }
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const status = await response.json();
                this.log(`Status response: ${JSON.stringify(status)}`);
                
                if (!status.connected) {
                    throw new Error(`Database not connected: ${status.database}`);
                }
                
                // Test actual data operations
                this.log('Testing data read/write operations...');
                const testResponse = await this.testDataOperations();
                
                if (testResponse.success) {
                    this.log('Database connection verified!', 'success');
                    this.databaseConnected = true;
                    return;
                } else {
                    throw new Error(`Data operations failed: ${testResponse.error}`);
                }
                
            } catch (error) {
                this.log(`Connection attempt ${attempt} failed: ${error.message}`, 'error');
                
                if (error.name === 'AbortError') {
                    this.log('Connection timeout - server may be down', 'error');
                } else if (error.message.includes('Failed to fetch')) {
                    this.log('Network error - cannot reach server', 'error');
                }
                
                if (attempt < maxRetries) {
                    this.log(`Retrying in ${retryDelay/1000} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                } else {
                    this.log('All connection attempts failed', 'error');
                }
            }
        }
        
        this.databaseConnected = false;
    }

    async testDataOperations() {
        try {
            // Test reading data
            const readResponse = await fetch('/api/counts');
            
            if (!readResponse.ok) {
                const errorData = await readResponse.json();
                return { success: false, error: errorData.error || 'Read operation failed' };
            }
            
            const data = await readResponse.json();
            this.log(`Data read successful: ben=${data.ben}, kaiti=${data.kaiti}`);
            
            // Update display with real data
            this.benCount.textContent = data.ben;
            this.kaitiCount.textContent = data.kaiti;
            this.updatePayoutTotal(data.ben + data.kaiti);
            
            return { success: true };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    enableApp() {
        this.log('Enabling app interface...', 'success');
        
        // Hide connection screen
        this.connectionScreen.style.display = 'none';
        
        // Show main app
        this.appContainer.style.display = 'flex';
        
        // Enable all buttons
        this.benButton.disabled = false;
        this.kaitiButton.disabled = false;
        this.payoutButton.disabled = false;
        
        // Bind events
        this.benButton.addEventListener('click', () => this.incrementSwear('ben'));
        this.kaitiButton.addEventListener('click', () => this.incrementSwear('kaiti'));
        this.payoutButton.addEventListener('click', () => this.payout());
        
        // Start polling for updates
        setInterval(() => this.syncData(), 3000);
        
        this.log('App ready for multi-device sync!', 'success');
    }

    showConnectionError() {
        this.log('Showing connection error modal...', 'error');
        
        this.errorMessage.textContent = 'Cannot establish database connection. The app requires a working database for device syncing.';
        this.errorDetails.textContent = this.connectionLog.join('\n');
        
        this.connectionScreen.style.display = 'none';
        this.errorModal.classList.add('show');
    }

    async retryConnection() {
        this.log('Retrying connection...');
        
        this.errorModal.classList.remove('show');
        this.connectionScreen.style.display = 'flex';
        this.connectionMessage.textContent = 'Retrying connection...';
        this.connectionMessage.style.color = 'white';
        
        await this.checkDatabaseConnection();
        
        if (this.databaseConnected) {
            this.enableApp();
        } else {
            this.showConnectionError();
        }
    }

    async syncData() {
        if (!this.databaseConnected) return;
        
        try {
            const response = await fetch('/api/counts');
            if (response.ok) {
                const data = await response.json();
                this.updateDisplay(data);
            }
        } catch (error) {
            this.log(`Sync failed: ${error.message}`, 'error');
        }
    }

    async incrementSwear(person) {
        if (!this.databaseConnected) {
            this.log('Cannot increment - database not connected', 'error');
            return;
        }

        this.log(`Incrementing ${person}'s count...`);
        
        try {
            const response = await fetch(`/api/swear/${person}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to increment count');
            }
            
            const data = await response.json();
            this.updateDisplay(data);
            this.animateButton(person);
            
            this.log(`${person}'s count updated to ${data[person]}`, 'success');
            
        } catch (error) {
            this.log(`Failed to increment ${person}: ${error.message}`, 'error');
            this.showError(`Failed to update count: ${error.message}`);
        }
    }

    async payout() {
        if (!this.databaseConnected) {
            this.log('Cannot payout - database not connected', 'error');
            return;
        }

        if (!confirm('Are you sure you want to reset both jar counts to zero?')) {
            return;
        }

        this.log('Processing payout...');
        
        try {
            const response = await fetch('/api/payout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to process payout');
            }
            
            const data = await response.json();
            this.updateDisplay(data);
            this.celebratePayout();
            
            this.log('Payout processed successfully', 'success');
            
        } catch (error) {
            this.log(`Payout failed: ${error.message}`, 'error');
            this.showError(`Failed to process payout: ${error.message}`);
        }
    }

    updateDisplay(data) {
        this.animateCountUpdate(this.benCount, data.ben);
        this.animateCountUpdate(this.kaitiCount, data.kaiti);
        this.updatePayoutTotal(data.ben + data.kaiti);
    }

    updatePayoutTotal(total) {
        this.payoutTotal.textContent = `$${total}`;
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

    showError(message) {
        // Could add toast notifications here
        console.error('App Error:', message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SwearJarApp();
});