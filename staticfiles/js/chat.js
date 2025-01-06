const chatInput = document.querySelector(".chat-input");
const sendButton = document.getElementById("send-button");
const micButton = document.getElementById("mic-button");
const chatMessages = document.querySelector(".chat-messages");
const micIcon = micButton.querySelector(".mic-icon");
const clearText = document.querySelector("#clear-text-field");

let isMicActive = false;
let newConnection = true;

document.querySelector(".chat-menu").style.height = "0";
document.querySelector(".chat-menu-btn").style.opacity = "0.7";

let userID = document.querySelector(".user-id").value.trim();
let roomID = document.querySelector(".room-id").value.trim();
const timestamp = new Date().getTime();
let url = `wss://${window.location.host}/ws/chat/${roomID}/${userID}/?&_=${timestamp}`;
console.log(url);
const chatSocket = new WebSocket(url);


// Play avatar audio message (Future Implementation)
let play_audio = function () {
  // Create a new AudioContext
  const audioContext = new AudioContext();

  // Create a new AudioBufferSourceNode
  const source = audioContext.createBufferSource();

  // Load the audio file
  fetch("/static/audio/pop notification.mp3")
    .then((response) => response.arrayBuffer())
    .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
    .then((audioBuffer) => {
      // Set the audio buffer
      source.buffer = audioBuffer;

      // Connect the source to the destination
      source.connect(audioContext.destination);

      // Start playing the audio
      source.start();
    });
}

// Update User Message
let userResponse = function (response) {
  let userMessageElement = `
            <div class="user">
            <div class="profile-pic message user"
              style="background: #969696 url('/static/images/chat/user.png') center/cover;">
            </div>
            <div class="message sent">
              ${response}
              <p class="message-user-id sent">YOU</p>
            </div>
          </div>
        `;
  const userMessage = document.createElement("div");
  userMessage.classList.add("user");
  userMessage.innerHTML = userMessageElement;
  chatMessages.appendChild(userMessage);

  chatInput.value = "";
  chatInput.style.height = "auto";
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Add typing animation
let typingAnimation = function() {
  let profile_pic = document.querySelector(".profile-pic").style.backgroundImage;
  profile_pic = profile_pic.replace(/"/g, "'");
  let typingAnimation = `
            <div class="profile-pic message avatar"
              style="background: ${profile_pic} center/cover;">
            </div>
            <div class="typing-dots">
              <div class="dot" style= "--delay: 200ms;"></div>
              <div class="dot" style= "--delay: 300ms;"></div>
              <div class="dot" style= "--delay: 400ms;"></div>
            </div>
            `;
  let div = document.createElement("div");
  div.classList.add("avatar");
  div.innerHTML = typingAnimation;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

let update_chats = function (data) {
  let senderID = data.userID;
  let message = data.message;

  if (userID === senderID) {return; }

  // Play Message Pop Audio
  play_audio();

  let messageElement = `
            <div class="sender">
            <div class="profile-pic message user"
              style="background: #969696 url('/static/images/chat/user.png') center/cover;">
            </div>
            <div class="message received">
              ${message}
              <p class="message-user-id received">${senderID}</p>
            </div>
          </div>
        `;
  const receivedMessage = document.createElement("div");
  receivedMessage.classList.add("sender");
  receivedMessage.innerHTML = messageElement;
  chatMessages.appendChild(receivedMessage);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

let update_members = function (data) {
  let new_member = data.new_member;
  new_member = new_member.split(" ").join(".");
  let new_memberList = data.new_memberList;
  let members = document.querySelector(".members");

  if (newConnection) {
    new_memberList.forEach((member) => {
      member = member.split(" ").join(".");
      let member_new = document.createElement("div");
      member_new.classList.add("member");
      member_new.classList.add(`${member}`);
      member_new.textContent = member;

      members.appendChild(member_new);
    });
    newConnection = false;
    return;
  }
  console.log("New Member:", new_member);
  let member_new = document.createElement("div");
  member_new.classList.add("member");
  member_new.classList.add(`${new_member}`);
  member_new.textContent = new_member;

  members.appendChild(member_new);  
}

let remove_member = function (data) {
  let removed_member = data.removed_member;
  console.log("Removed Member:", removed_member);
  if (!removed_member) {return;}
  console.log("Removed Member:", removed_member);
  removed_member = removed_member.split(" ").join(".");
  let members = document.querySelector(".members");
  let member = members.querySelector(`.member.${removed_member}`);

  if (!member) {return;}
  members.removeChild(member);
  console.log("Removed Member:", removed_member);
}


// Send message function
function sendMessage() {
  let message = chatInput.value.trim();
  if (message) {
    // Add message to the chats
    userResponse(message);

    // Create message object
    const message_obj = {
      'userID': userID,
      'message': message,
    };

    // send data to server
    chatSocket.send(JSON.stringify(message_obj));
    chatInput.value = "";
  }
}

// ________________________ Socket Connection _________________________

// Establish a Websocket connection with the server and communicate
chatSocket.onopen = () => {
  console.log("connected");
}

// Recieve Data from the server
chatSocket.onmessage = function (event) {
  let data = JSON.parse(event.data);
  switch (data.statusCode) {
    case 200:
      update_chats(data);
      break;

    case 202:
      console.log(data.server);
      break;

    case 204:
      update_members(data);
      break;
    
    case 206:
      remove_member(data);
      break;

    default:
      return;
  }
};

// ______________________________________________________________________


// Auto-resize input field
chatInput.addEventListener("input", function () {
  this.style.height = "auto";
  this.style.height = this.scrollHeight + "px";

  if (this.value === "") {
    this.style.height = "auto";
  }
});

// Clear the text input field
clearText.addEventListener("click", function () {
  chatInput.value = '';

})

// Send message on enter
chatInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Toggle microphone
micButton.addEventListener("click", function () {
  isMicActive = !isMicActive;
  micIcon.classList.toggle("mic-active");

  if (isMicActive) {
    chatInput.placeholder = "Listening...";
    micButton.id = "mic-button-active";
  } else {
    chatInput.placeholder = "Type a message...";
    micButton.id = "mic-button";
  }
});

// Back button animation
document.querySelector(".back-button").addEventListener("click", function () {
  this.style.transform = "translateX(-.8rem)";
  setTimeout(() => {
    this.style.transform = "translateX(0)";
    window.location.href = `${window.location.origin}/chat-magic/join-chat-room`;
  }, 200);
});

// Chat Menu Toggle
document.querySelector(".chat-menu-btn").addEventListener("click", function () {
  let menu = document.querySelector(".chat-menu");
  menu.style.height = (menu.style.height === "0px") ? "100%" : "0";
  this.style.opacity = (this.style.opacity === "0.7") ? "1" : "0.7";
})

// Show group members
document.querySelector(".group-members").addEventListener("click", function (e) {
  document.querySelector(".check-group-members").classList.toggle("active");
});

// chatInput.value = `${window.innerHeight}`;
// Add smooth scrolling to messages
chatMessages.style.scrollBehavior = "smooth";
sendButton.addEventListener("click", sendMessage);
