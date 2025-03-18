import React from "react";
import "./App.css";
import ChatWindow from "./components/ChatWindow";

function App() {
  return (
    <div className="App">
      <div className="heading">
        <img 
          src="/partselect-header.png" 
          alt="PartSelect Header" 
          className="header-logo" 
        />
        <span className="heading-text">Part Assistance Agent</span>
      </div>
      <ChatWindow/>
    </div>
  );
}

export default App;
