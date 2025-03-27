// 😜 mock API and Batch API flags (Server.js will change route to chatController.js, mockChatController.js or batchController.js file.)
// Set both false to use Synchronous API and /chat endpoint via real OpenAI API
const useMockAPI = false; // Set true for using mock API and /api/mock-chat endpoint
const useBatchAPI = false; // Set true for using Batch API and /batchchat endpoint via real OpenAI API



import { HintsPopover } from './hints.js';

document.addEventListener('DOMContentLoaded', async () => {
  // 🎯 UI Elements
  const startButton = document.getElementById('start-button');
  const micButton = document.getElementById('mic-button');
  const chatSection = document.getElementById('chat-section');
  const messagesContainer = document.getElementById('messages');
  const clearButton = document.getElementById('clear-button');
  const bearAnimation = document.getElementById('bear-animation');
  const lessonNumber = window.location.pathname.split('/')[2];
  const userLevelButtons = document.querySelectorAll('.user-level-button');
  const hintPopover = new HintsPopover('hint-button', 'hints-list-container');

  // 🏗️ Variables
  let tasks = [];
  let completedTasks = new Set();
  let taskAnswers = {};
  let conversationStarted = false;
  let userMessageCounter = 0;  // Unique counter for each user message
  let lastUserMessageId = null;
  let lastLillianMessage = null; // Store Lillian's last message.
  let micTimeout;  // Variable to hold the timeout ID for auto-stopping the mic.
  let userLevel = sessionStorage.getItem("userLevel") || "A1";
  let recordFailCount = 0; // New: Count how many times the recording resulted in an empty message

  // Helper Function: Determine the CurrentTaskId
  function getCurrentTaskId() {
    return tasks.find(task => !completedTasks.has(task._id))?._id || null;
  }

  // Fetching Tasks From API (Modified for next task instead of remaining tasks)
  async function fetchNextTask(lessonNumber) {
    try {
      const response = await fetch(`/api/lessons/${lessonNumber}`);
      const lessonData = await response.json();

      console.log("Fetched lesson data:", lessonData);
      
      if (lessonData && Array.isArray(lessonData.task_list)) {
        const nextTask = lessonData.task_list.find(task => !completedTasks.has(task._id));
        if (nextTask) {
          tasks = [nextTask];
          updateTaskProgress();
          startConversation(lessonData.objective);
        }
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  }

  // 🔧 UI Setup
  chatSection.style.display = 'none';
  micButton.textContent = "🎤 Speak";
  updateUserLevelSelection(userLevel);

  // User Level Selection
  function updateUserLevelSelection(selectedLevel) {
    sessionStorage.setItem("userLevel", selectedLevel);
    userLevelButtons.forEach(button => button.classList.remove("active"));
    document.querySelector(`.user-level-button[data-level="${selectedLevel}"]`).classList.add("active");
  }
  
  userLevelButtons.forEach(button => {
    button.addEventListener("click", (event) => {
      const selectedLevel = event.target.dataset.level;
      if (selectedLevel !== userLevel) {
        userLevel = selectedLevel;
        updateUserLevelSelection(userLevel);
        fetchTasks(lessonNumber);
      }
    });
  });
  
  // 🎬 Start Conversation
  startButton.addEventListener('click', async () => {
    chatSection.style.display = 'block';
    await fetchTasks(lessonNumber);
    setTimeout(() => {
      window.scrollTo({
        top: chatSection.offsetTop,
        behavior: 'smooth'
      });
    }, 100);
    micButton.disabled = false;
  });

  // 🗑️ Clear Chat
  clearButton.addEventListener('click', () => {
    messagesContainer.innerHTML = '';
    completedTasks.clear();
    taskAnswers = {};
    lastUserMessageId = null;
    conversationStarted = false;
    updateTaskProgress();
    startButton.disabled = false;
  });

  // 🎤 Microphone Handling
  function checkRemainingTasks() {
    if (tasks.length > 0 && completedTasks.size >= tasks.length) {
      micButton.disabled = true;
    } else {
      micButton.disabled = false;
    }
  }

  micButton.addEventListener('click', handleMicClick);
  let recognition; //SpeechRecognition object that will handle speech-to-text functionality
  let accumulatedTranscript = "";  // Accumulate finalized transcript
  let lastPauseTime = null;  // Track the last pause time

  // Function to display Real-Time Text
  function displayRealTimeText(interimText, accumulatedText) {
    const messagesContainer = document.getElementById('messages');
    let realTimeTextContainer = document.getElementById('real-time-text');
    if (!realTimeTextContainer) {
      realTimeTextContainer = document.createElement('div');
      realTimeTextContainer.id = 'real-time-text';
      realTimeTextContainer.classList.add('real-time-text');
      messagesContainer.appendChild(realTimeTextContainer);
    }
    realTimeTextContainer.textContent = `(🔘 ...) User: ${accumulatedText}${interimText}`;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  //Handling the Microphone Click
  async function handleMicClick() {
    // 🔒 Prevent recording if all tasks are completed
    if (tasks.length > 0 && completedTasks.size >= tasks.length) {
      console.log("✅ All tasks completed — mic disabled");
      micButton.disabled = true;
      return; // Stop further execution if no remaining tasks
    }

    if (micButton.textContent === '🎤 Speak') {
      recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      recognition.lang = 'de-DE';
      recognition.continuous = true;
      recognition.interimResults = true;

      // Start recording
      recognition.onresult = (event) => {
        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            let finalTranscript = result[0].transcript.trim();

            // Add punctuation if there is a pause (e.g., more than 1 second)
            if (lastPauseTime && Date.now() - lastPauseTime > 1000) {
              finalTranscript += finalTranscript.charAt(finalTranscript.length - 1).match(/[.!?]/) ? '' : '.';
            }

            // Capitalize the first letter of the final transcript
            finalTranscript = finalTranscript.charAt(0).toUpperCase() + finalTranscript.slice(1);

            // Add to the accumulated transcript
            accumulatedTranscript += finalTranscript + " ";
            lastPauseTime = null;  // Reset pause time after processing
        } else {
            interimText += result[0].transcript;
        }
      }

      // Update the UI with real-time text
      // Capitalize and add punctuation in real-time text as well
      let realTimeText = interimText.trim();
      if (realTimeText) {
          realTimeText = realTimeText.charAt(0).toUpperCase() + realTimeText.slice(1);
          if (lastPauseTime && Date.now() - lastPauseTime > 1000 && !realTimeText.match(/[.!?]$/)) {
              realTimeText += '.';
          }
        }

        displayRealTimeText(realTimeText, accumulatedTranscript);
      };

      recognition.onerror = () => {
        addMessage('Lillian', 'Entschuldigung, ich habe das nicht verstanden. Versuch es nochmal! 😉');
        speakText('Entschuldigung, ich habe das nicht verstanden. Versuch es nochmal!');
        micButton.textContent = '🎤 Speak';
      };

      recognition.onend = async () => {
        micButton.textContent = '🎤 Speak';
        // Validate: if the transcript is empty, show error and do not send to backend.
        if (accumulatedTranscript.trim() === "") {
          recordFailCount++;
          let errorMsg = "";
          if (recordFailCount === 1) {
            errorMsg = "Entschuldigung, ich habe dich nicht gehört. Versuch es nochmal! 😉";
            speakText('Entschuldigung, ich habe dich nicht gehört. Versuch es nochmal!')
          } else if (recordFailCount === 2) {
            errorMsg = "Ich höre dich immer noch nicht. Sprich bitte deutlich oder überprüfe dein Mikrofon. 🎤";
            speakText('Ich höre dich immer noch nicht. Sprich bitte deutlich oder überprüfe dein Mikrofon.')
          } else {
            errorMsg = "Dein Mikrofon funktioniert vielleicht nicht. Kannst du bitte die Einstellungen überprüfen? 🛠️";
            speakText('Dein Mikrofon funktioniert vielleicht nicht. Kannst du bitte die Einstellungen überprüfen?')
          }
          // Display error message (as a message from Lillian)
          addMessage('Lillian', errorMsg);
          // Clear accumulated transcript and do not proceed further.
          accumulatedTranscript = "";
          return; // Stop further execution
        } else {
          recordFailCount = 0; // Reset fail count if transcript is successful
        }

        // Finalize the UserMessage, ensuring it is capitalized and has punctuation
        let UserMessage = accumulatedTranscript.trim();
        if (!UserMessage) {
            accumulatedTranscript = "";
            return;
        }

        // Capitalize the first letter of the final message
        UserMessage = UserMessage.charAt(0).toUpperCase() + UserMessage.slice(1);

        // Add the finalized user message
        addMessage('User', UserMessage, true);

        const realTimeTextContainer = document.getElementById('real-time-text');
        if (realTimeTextContainer) {
            realTimeTextContainer.remove(); // Remove real-time text display
        }

        // Show confirmation buttons for the user to either redo or confirm the message
        showConfirmationButtons(UserMessage);
        accumulatedTranscript = ""; // Reset the accumulated transcript for the next recording
      };

      recognition.start();
      micButton.textContent = '🔘 Recording...Pause';
      micTimeout = setTimeout(() => recognition.stop(), 15000);
    } else {
      clearTimeout(micTimeout);
      recognition.stop();
      micButton.textContent = '🎤 Speak';
    }
  }

  // Function to display confirmation buttons next to the final user message
  function showConfirmationButtons(UserMessage) {
    const userMsgDiv = document.getElementById(lastUserMessageId);
    if (!userMsgDiv) return;

    // Disable mic button when confirmation buttons are displayed
    micButton.disabled = true;

    const btnContainer = document.createElement('span');
    btnContainer.className = 'confirmation-buttons';
    
    const redoBtn = document.createElement('button');
    redoBtn.textContent = "🎤";
    redoBtn.title = "Record again";
    redoBtn.classList.add('redo-btn');
    
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = "✅";
    confirmBtn.title = "Confirm response";
    confirmBtn.classList.add('confirm-btn');

    btnContainer.appendChild(redoBtn);
    btnContainer.appendChild(confirmBtn);
    userMsgDiv.appendChild(btnContainer);

    // Redo: Remove message and activate mic immediately.
    redoBtn.addEventListener('click', () => {
      userMsgDiv.remove();
      micButton.disabled = false; // Re-enable the mic button
      handleMicClick(); // Start recording immediately
    });

    // Confirm: Remove buttons and send confirmed message to backend.
    confirmBtn.addEventListener('click', async () => {
      btnContainer.remove();
      await sendMessageToBackend(UserMessage);
      micButton.disabled = false; // Re-enable the mic button after confirmation
    });
  }
    
  // Fetching Tasks From API
  async function fetchTasks(lessonNumber) {
    try {
      const response = await fetch(`/api/lessons/${lessonNumber}`);
      const lessonData = await response.json();
      console.log("Fetched lesson data dynamic for user level:", userLevel, lessonData);
      if (lessonData && Array.isArray(lessonData.task_list)) {
        tasks = lessonData.task_list.flatMap((item, index) => {
          if (typeof item === 'string') {
            return [{
              _id: `task-${index}-main`,
              task: item,
            }];
          } else if (typeof item === 'object') {
            if (item.sub_tasks && Array.isArray(item.sub_tasks) && item.sub_tasks.length > 0) {
              return item.sub_tasks.map((sub, subIndex) => ({
                _id: `task-${index}-sub-${subIndex}`,
                task: sub,
              }));
            } else {
              let taskText = "";
              if (item.task && typeof item.task === 'string' && item.task.trim() !== "") {
                taskText = item.task;
              } else {
                const numericKeys = Object.keys(item).filter(key => /^\d+$/.test(key));
                numericKeys.sort((a, b) => Number(a) - Number(b));
                taskText = numericKeys.map(key => item[key]).join('').trim();
              }
              return taskText ? [{
                _id: `task-${index}-main`,
                task: taskText,
              }] : [];
            }
          }
          return [];
        });
        console.log("Processed tasks array:", tasks);
        updateTaskProgress();
        startConversation(lessonData.objective);
      } else {
        console.error("No valid tasks available.");
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  }

  // 🗣️ Speech Output
  function speakText(text) {
    console.log(`Speaking text: ${text}`);
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'de-DE';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
      utterance.onstart = () => {
        console.log("Speech synthesis started.");
      };
    } else {
      console.warn("Speech synthesis is not supported in this browser.");
    }
  }

  // 🏁 Start Conversation
  function startConversation(objective) {
    if (conversationStarted) return;
    conversationStarted = true;
    chatSection.style.display = 'block';
    showBearAnimation();
    const greeting = "Hallo! Ich heiße Lillian. Wie geht es Ihnen?";
    addMessage('Lillian', greeting);
    lastLillianMessage = greeting;
    speakText(greeting);
    micButton.style.display = 'inline-block';
  }
  
  function showBearAnimation() {
    if (bearAnimation) {
      bearAnimation.innerHTML = "";
      try {
        lottie.loadAnimation({
          container: bearAnimation,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: '/static/animations/polar-bear-animation.json'
        });
      } catch (error) {
        console.error('Error initializing animation:', error);
      }
    }
  }

  // 💬 Message Handling
  function addMessage(role, text, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role === 'Lillian' ? 'ai-message' : 'user-message'}`;
    if (isUser) {
      text = text.charAt(0).toUpperCase() + text.slice(1);
    }
    if (isUser) {
      const messageId = `user-message-${userMessageCounter++}`;
      messageDiv.id = messageId;
      lastUserMessageId = messageId;
      messageDiv.textContent = `${role}: ${text}`;
    } else {
      messageDiv.textContent = `${role}: ${text}`;
    }
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  // Function to send confirmed message to the backend
  async function sendMessageToBackend(UserMessage) {
    try {
      const currentTaskId = getCurrentTaskId();
      
      // 🔀 Choose the API endpoint based on flags
      const apiEndpoint = useMockAPI 
      ? '/api/mock-chat' 
      : useBatchAPI 
        ? '/batchchat' 
        : '/chat';
      console.log(`Sending to endpoint: ${apiEndpoint}`); // Debug log

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastLillianMessage: lastLillianMessage,
          userMessage: UserMessage,
          lessonId: lessonNumber,
          userLevel: userLevel,
          id: currentTaskId, // Sending task ID to backend
          completedTasks: Array.from(completedTasks), // Sending completed tasks
        })
      });
      const data = await response.json();
      console.log("AI Response:", data);
      console.log("Lillian Response Data:", data.lillian_response);
    
      
      if (data.usererror_feedback && data.usererror_feedback.length > 0 && lastUserMessageId) {
        updateLastUserMessage(lastUserMessageId, data.usererror_feedback);
      }
      console.log("Updating user message with errors", data.usererror_feedback);
      completedTasks = new Set(data.completedTasks);
      if (data.extracted_answer && currentTaskId) {
        taskAnswers[currentTaskId] = ` <span class="extracted-answer">${data.extracted_answer}</span>`;
        console.log("Updated taskAnswers:", taskAnswers);
      }
      updateTaskProgress();
      if (completedTasks.size === tasks.length) {
        micButton.disabled = true; // Disable mic button when confirmation buttons are displayed
      }
      if (data.lillian_response) {
        setTimeout(() => {
            addMessage('Lillian', data.lillian_response);
            speakText(data.lillian_response);
            lastLillianMessage = data.lillian_response;
            console.log("Updated lastLillianMessage:", lastLillianMessage);
        }, 10);
      } else {
        addMessage('Lillian', "Entschuldigung, ich habe das nicht verstanden. Könnten Sie es bitte noch einmal erklären? 😉");
        lastLillianMessage = "Entschuldigung, ich habe das nicht verstanden. Könnten Sie es bitte noch einmal erklären? 😉";
        speakText('Entschuldigung, ich habe das nicht verstanden. Könnten Sie es bitte noch einmal erklären?');
      }
    } catch (error) {
      console.error("Error sending message to backend:", error);
      addMessage('Lillian', "Es gibt ein Problem mit der Verbindung. Überprüf dein Internet. 🛜");
      speakText('Es gibt ein Problem mit der Verbindung. Überprüf dein Internet.');
    }
  }
  
  function updateTaskProgress() {
    const taskProgress = document.getElementById('task-progress');
    taskProgress.textContent = `Task Progress: ${completedTasks.size}/${tasks.length}`;
    
    const progressBar = document.getElementById('progress-bar');
    const progressPercentage = (completedTasks.size / tasks.length) * 100;
    progressBar.value = progressPercentage;
    
    renderTaskListProgress();
  }

  function renderTaskListProgress() {
    const progressContainer = document.getElementById('task-list-progress');
    progressContainer.innerHTML = "";
    tasks.forEach(task => {
      const li = document.createElement('li');
      li.textContent = task.task;
      if (completedTasks.has(task._id)) { // Using task._id consistently
        li.textContent += " ✅";
        li.classList.add('task-completed');
        if (taskAnswers[task._id]) {
          li.innerHTML += taskAnswers[task._id];
        }
      }
      progressContainer.appendChild(li);
    });
  }
  //handle the category field correctly by checking whether it is an array or a string
  function processUserMessage(message, usererrorFeedback) {
    let processedMessage = message;
    if (typeof message === "string") {
        usererrorFeedback.forEach(feedback => {
            const { usererror_segment, category } = feedback;
            let tooltipText = ""; // Initialize tooltip text as an empty string
            // Check if category is an array or a string.
            if (Array.isArray(category)) {
              tooltipText += category.map(cat => {
                if (cat === "spelling") return "Spelling mistake";
                else if (cat === "grammar") return "Grammatical error";
                else if (cat === "off-topic") return "Off-topic";
                else if (cat === "collocation") return "Collocation error";
                else return cat;
              }).join(" & ");
            } else if (typeof category === "string") {
              if (category === "spelling") tooltipText = "Spelling mistake";
              else if (category === "grammar") tooltipText = "Grammatical error";
              else if (category === "off-topic") tooltipText = "Off-topic";
              else if (category === "collocation") tooltipText = "Collocation error";
              else tooltipText = category;
            }

            // Add explanation if available
            if (feedback.explanation) {
              tooltipText += `. ${feedback.explanation}`;
            }
            // Create a regular expression for the user error segment to match case-insensitively
            const regex = new RegExp(`\\b${escapeRegExp(usererror_segment.toLowerCase())}\\b`, "gi");
            // Wrap matched text with a span for error highlighting.
            processedMessage = processedMessage.replace(regex, (match) => {
              return `<span class="error-text error-${(Array.isArray(category) ? category.join(' ') : category)}" data-tooltip="${tooltipText}">${match}</span>`;
            });
          });
        } else {
          console.warn("Received message is not a string:", message);
        }
        return processedMessage;
      }
  
  // Utility function to escape special characters in a string for use in a regular expression
  function escapeRegExp(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  }
  
  function updateLastUserMessage(messageId, usererrorFeedback) {
    const userMsgDiv = document.getElementById(messageId);
    if (userMsgDiv) {
      let originalText = userMsgDiv.textContent.replace(/^User:\s*/, '');
      console.log("Original user message before processing:", originalText);
      const processedHTML = processUserMessage(originalText, usererrorFeedback);
      console.log("Processed message with errors:", processedHTML);
      userMsgDiv.innerHTML = `User: ${processedHTML}`;
      const errorSpans = userMsgDiv.querySelectorAll('.error-text');
      errorSpans.forEach(span => {
        span.addEventListener('mouseenter', showTooltip);
        span.addEventListener('mouseleave', hideTooltip);
      });
    } else {
      console.warn("No user message div found with ID:", messageId);
    }
  }
  
  function showTooltip(e) {
    const tooltipText = e.target.getAttribute('data-tooltip');
    let tooltip = document.createElement('div');
    tooltip.id = "error-tooltip";
    tooltip.textContent = tooltipText;
    tooltip.style.top = `${e.target.getBoundingClientRect().top + window.scrollY - 25}px`;
    tooltip.style.left = `${e.target.getBoundingClientRect().right + 5}px`;
    document.body.appendChild(tooltip);
  }
  
  function hideTooltip(e) {
    const tooltip = document.getElementById("error-tooltip");
    if (tooltip) {
      tooltip.remove();
    }
  }  
});
