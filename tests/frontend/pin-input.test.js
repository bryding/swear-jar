describe('PIN Input Component', () => {
  let pinInputs;
  let pinContainer;

  beforeEach(() => {
    // Create DOM
    global.createMockDOM();
    
    // Get PIN input elements directly
    pinInputs = [
      document.getElementById('digit0'),
      document.getElementById('digit1'),
      document.getElementById('digit2'),
      document.getElementById('digit3'),
      document.getElementById('digit4')
    ];
    pinContainer = document.querySelector('.pin-input-container');
  });

  describe('DOM Structure', () => {
    test('should have all PIN input elements', () => {
      expect(pinInputs).toHaveLength(5);
      pinInputs.forEach((input, index) => {
        expect(input).not.toBeNull();
        expect(input.id).toBe(`digit${index}`);
        expect(input.getAttribute('maxlength')).toBe('1');
        expect(input.classList.contains('pin-digit')).toBe(true);
      });
    });

    test('should have pin container element', () => {
      expect(pinContainer).not.toBeNull();
      expect(pinContainer.classList.contains('pin-input-container')).toBe(true);
    });
    
    test('should accept digits in input elements', () => {
      const input = pinInputs[0];
      
      // Test setting valid digit
      input.value = '5';
      expect(input.value).toBe('5');
      
      // Test setting another digit
      input.value = '9';
      expect(input.value).toBe('9');
      
      // Test clearing
      input.value = '';
      expect(input.value).toBe('');
    });

  });
});