/**
 * Plandex Integration Module
 * Handles communication with a self-hosted Plandex server.
 */
class PlandexIntegration {
    constructor(pcbEditor, apiUrl = 'http://localhost:8099/v1') {
        this.pcbEditor = pcbEditor;
        this.apiUrl = apiUrl;
        this.isBusy = false;
    }

    /**
     * Builds the context from the current PCB state to be sent to Plandex.
     * @returns {string} A string representation of the PCB context.
     */
    buildContext() {
        const objects = this.pcbEditor.getObjects();
        const designRules = this.pcbEditor.designRules.getRules();

        const context = {
            summary: `PCB design with ${objects.length} objects.`,
            designRules: designRules,
            objects: objects.map(obj => obj.toJSON())
        };

        // Convert to a string format, e.g., JSON or a custom format.
        return JSON.stringify(context, null, 2);
    }

    /**
     * Sends a prompt and the current PCB context to the Plandex server.
     * @param {string} prompt - The user's prompt for Plandex.
     * @returns {Promise<Object>} The response from the Plandex server.
     */
    async sendPrompt(prompt) {
        if (this.isBusy) {
            console.warn('Plandex is already processing a request.');
            return;
        }

        this.isBusy = true;
        this.updateUI({ status: 'busy' });

        try {
            const context = this.buildContext();
            
            // This is a placeholder for the actual Plandex API structure.
            // The real API might require a different payload format.
            const response = await fetch(`${this.apiUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'default', // Or a model configured in Plandex
                    messages: [
                        { role: 'system', content: 'You are a PCB design assistant. The user has provided the current PCB state as JSON. Respond with a plan to modify the design based on the user\'s request.' },
                        { role: 'user', content: `Context:\n${context}\n\nRequest: ${prompt}` }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error(`Plandex API error: ${response.statusText}`);
            }

            const result = await response.json();
            this.updateUI({ status: 'idle', response: result });
            return result;

        } catch (error) {
            console.error('Error communicating with Plandex:', error);
            this.updateUI({ status: 'error', error: error.message });
        } finally {
            this.isBusy = false;
        }
    }

    /**
     * Applies changes received from Plandex to the PCB editor.
     * @param {Object} changes - The changes proposed by Plandex.
     */
    applyChanges(changes) {
        // This is a placeholder for the change application logic.
        // The format of 'changes' will depend on how Plandex is configured
        // to respond (e.g., a diff, a list of commands, or a full new state).
        console.log('Applying changes from Plandex:', changes);

        // Example: If Plandex returns a new set of objects
        if (changes.newObjects) {
            this.pcbEditor.setObjects(changes.newObjects);
            this.pcbEditor.render();
            this.pcbEditor.saveState();
        }
        
        alert('Changes from Plandex have been applied.');
    }

    /**
     * Updates the Plandex UI panel with the current state.
     * @param {Object} state - The current state (e.g., busy, idle, error).
     */
    updateUI(state) {
        const plandexPanel = document.getElementById('plandex-panel');
        if (!plandexPanel) return;

        const statusEl = plandexPanel.querySelector('.plandex-status');
        const responseEl = plandexPanel.querySelector('.plandex-response');

        if (state.status === 'busy') {
            statusEl.textContent = 'Plandex is thinking...';
            responseEl.innerHTML = '';
        } else if (state.status === 'idle') {
            statusEl.textContent = 'Ready for your command.';
            if (state.response) {
                // Display the response from Plandex
                responseEl.textContent = JSON.stringify(state.response, null, 2);
            }
        } else if (state.status === 'error') {
            statusEl.textContent = 'An error occurred.';
            responseEl.textContent = state.error;
        }
    }
}

// Export for use in other modules
window.PlandexIntegration = PlandexIntegration;
