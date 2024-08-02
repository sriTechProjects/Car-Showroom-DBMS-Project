function checkLoginStatus() {
  fetch('/checkLoginStatus')
      .then(response => response.json())
      .then(data => {
          const avatar = document.getElementById("avatar");
          const loginButton = document.getElementById("loginButton");
          if (data.loggedIn) {
              avatar.classList.remove("avatar");
              avatar.classList.add("avatar-box");
              loginButton.classList.add("avatar");
          }
          else {
              document.getElementById('avatar').style.display = 'none';
          }
      });
}

checkLoginStatus();

console.log("JS mein aagaya")
