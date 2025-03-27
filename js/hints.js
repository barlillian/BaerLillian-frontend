export class HintsPopover {
    constructor(hintButtonId, hintsListContainerId) {
      this.hintButton = document.getElementById(hintButtonId);
      this.hintsListContainer = document.getElementById(hintsListContainerId);
      this.hintsPopover = document.createElement('div');
      document.body.appendChild(this.hintsPopover);
      this.hintsPopover.classList.add('hints-popover');
  
      this.addEventListeners();
    }
  
    addEventListeners() {
      // When clicking the hint button, fetch and display the hints
      this.hintButton.addEventListener('click', async (event) => {
        try {
          const response = await fetch('/api/hints');
          const hints = await response.json();
          
          const groupedHints = hints.reduce((acc, hint) => {
            const key = hint.category;
            if (!acc[key]) {
              acc[key] = { scenario: hint.scenario, hints: [] };
            }
            acc[key].hints.push(hint);
            return acc;
          }, {});
  
          this.hintsPopover.innerHTML = ''; // Clear existing content
  
          // Introductory line
          const introLine = document.createElement('div');
          introLine.className = 'hint-intro-line';
          introLine.textContent = "💡 Hint: If confused during a conversation, ask for... ";
          this.hintsPopover.appendChild(introLine);
  
          let firstCategoryExpanded = true;
          for (const category in groupedHints) {
            const group = groupedHints[category];
  
            // Group header
            const groupHeader = document.createElement('div');
            groupHeader.className = 'hint-group-header';

            // Plus icon first
            const plusIcon = document.createElement('span');
            plusIcon.className = 'expand-icon';
            plusIcon.textContent = '+';
            plusIcon.style.cursor = 'pointer';
  
            // Category element
            const categoryElement = document.createElement('strong');
            categoryElement.textContent = category;
  
            // Scenario element
            const scenarioElement = document.createElement('span');
            scenarioElement.className = 'scenario-text';
            scenarioElement.style.fontStyle = 'italic';
            scenarioElement.textContent = group.scenario;
  
            // Append the elements in the new order: "+" icon, category, and scenario
            groupHeader.appendChild(plusIcon);
            groupHeader.appendChild(categoryElement);
            groupHeader.appendChild(scenarioElement);
            
            this.hintsPopover.appendChild(groupHeader);
  
            // Hints container
            const hintsContainer = document.createElement('div');
            hintsContainer.className = 'hints-container';
            hintsContainer.style.display = firstCategoryExpanded ? 'block' : 'none';
  
            group.hints.forEach((hint) => {
              const hintDiv = document.createElement('div');
              hintDiv.className = 'hint-item';
  
              const audioButton = document.createElement('button');
              audioButton.className = 'audio-button';
              audioButton.innerHTML = '▶️';
  
              const germanText = document.createElement('span');
              germanText.className = 'german-text';
              germanText.textContent = hint.german_sentence;
  
              const translation = document.createElement('span');
              translation.className = 'translation';
              translation.textContent = ` ${hint.english_translation}`;
  
              const sentenceContainer = document.createElement('div');
              sentenceContainer.className = 'sentence-container';
              sentenceContainer.appendChild(germanText);
              sentenceContainer.appendChild(translation);
  
              // When clicking the sentence container or audio icon, play audio (make sure speakText is available)
              sentenceContainer.addEventListener('click', () => {
                speakText(hint.german_sentence);
              });
              audioButton.addEventListener('click', () => {
                speakText(hint.german_sentence); 
              });
  
              hintDiv.appendChild(audioButton);
              hintDiv.appendChild(sentenceContainer);
              hintsContainer.appendChild(hintDiv);
            });
  
            this.hintsPopover.appendChild(hintsContainer);
  
            // Toggle behavior for the group header
            groupHeader.addEventListener('click', () => {
              document.querySelectorAll('.hints-container').forEach(container => {
                if (container !== hintsContainer) {
                  container.style.display = 'none';
                }
              });
              document.querySelectorAll('.expand-icon').forEach(icon => {
                if (icon !== plusIcon) {
                  icon.textContent = '+';
                }
              });
  
              if (hintsContainer.style.display === 'none') {
                hintsContainer.style.display = 'block';
                plusIcon.textContent = '-';
              } else {
                hintsContainer.style.display = 'none';
                plusIcon.textContent = '+';
              }
            });
  
            firstCategoryExpanded = false;
          }
          
          this.hintsPopover.style.display = 'block';
          this.positionPopover(event);
  
        } catch (error) {
          console.error('Error fetching hints:', error);
        }
      });
  
      // Hide popover when clicking outside
      document.addEventListener('click', (event) => {
        if (!this.hintsPopover.contains(event.target) && event.target !== this.hintButton) {
          this.hintsPopover.style.display = 'none';
        }
      });
    }
  
    positionPopover(event) {
      const popoverWidth = this.hintsPopover.offsetWidth;
      const popoverHeight = this.hintsPopover.offsetHeight;
      const offsetX = 15;
      const offsetY = 15;
      let x = event.clientX + offsetX;
      let y = event.clientY + offsetY;
      
      if (x + popoverWidth > window.innerWidth) {
        x = window.innerWidth - popoverWidth - 15;
      }
      if (y + popoverHeight > window.innerHeight) {
        y = window.innerHeight - popoverHeight - 15;
      }
      
      this.hintsPopover.style.left = `${x}px`;
      this.hintsPopover.style.top = `${y}px`;
    }
  }
  
  // Make sure to also export or define speakText if not imported:
  function speakText(text) {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'de-DE';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }
  