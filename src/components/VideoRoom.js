import React, { useContext, useEffect, useState, useRef } from "react";
import Toolbar from "./Toolbar";
import Videos from "./Videos";
import OvContext from "../../context/openVidu";
import {
  STREAM_CREATED,
  SIGNAL_USER_CHANGED,
  STREAM_DESTROYED,
} from "./constants/signals";
import "../styles/index.css";

export default function VideoRoom() {
  const OV = useContext(OvContext);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [subscribers, setSubscribers] = useState({});
  const session = useRef(OV.current && OV.current.initSession());
  const [publisher, setPublisher] = useState(
    OV.initPublisher(undefined, {
      audioSource: undefined,
      videoSource: undefined,
      publishAudio: isMicOn || false,
      publishVideo: isCameraOn || false,
      resolution: "1280x720",
      frameRate: 30,
      insertMode: "APPEND",
    })
  );
  const [showVideoContainer, setShowVideoContainer] = useState(false);
  const myUserName = useRef("OpenVidu_User" + Math.floor(Math.random() * 100));
  const mainContainerRef = useRef();
  const session = useRef(OV.initSession());

  /* Initialize Video/Audio Session */
  const init = async () => {
    session.current &&
      session.current
        .on(STREAM_CREATED, handleSessionStreamCreated)
        .on(SIGNAL_USER_CHANGED, handleSignalUserChanged)
        .on(STREAM_DESTROYED, handleSessionStreamDestroy);

    await connect();
    setShowVideoContainer(true);
  };

  useEffect(() => {
    init();
    window.addEventListener("beforeunload", leaveSession);
    return () => {
      window.removeEventListener("beforeunload", leaveSession);
    };
  }, []);

  /* Audio/Video Toggle */
  useEffect(() => {
    if (publisher.stream.streamId) {
      publisher.publishAudio(isMicOn);
      publisher.publishVideo(isCameraOn);
      sendSignalUserChanged();
    }
  }, [isCameraOn, isMicOn]);

  /* Sending out event that the signal:userChanged for the session with the data passed in to the event */
  const sendSignalUserChanged = async () => {
    const signalOptions = {
      data: JSON.stringify({
        subscriberId: publisher.stream.streamId,
        isCameraOn,
        isMicOn,
      }),
      type: ,
    };
    await session.current.signal(signalOptions);
  };

  /* Handle subscribers */
  const handleSessionStreamCreated = ({ stream }) => {
    const subscriber = session.current.subscribe(stream, undefined);
    const newSubscriber = {
      stream: subscriber,
      isMicOn: false,
      isCameraOn: false,
    };

    setSubscribers((prevSubscribers) => {
      prevSubscribers[subscriber.stream.streamId] = newSubscriber;
      return { ...prevSubscribers };
    });
  };

  const handleSignalUserChanged = ({ data }) => {
    const dataObj = JSON.parse(data);
    if (dataObj.subscriberId !== publisher.stream.streamId) {
      setSubscribers((prevSubscribers) => {
        const newSubscriberSettings = {
          ...prevSubscribers[dataObj.subscriberId],
          isMicOn: dataObj.isMicOn,
          isCameraOn: dataObj.isCameraOn,
        };
        prevSubscribers[dataObj.subscriberId] = newSubscriberSettings;
        return { ...prevSubscribers };
      });
    }
  };

  /* Destroy Stream */
  const handleSessionStreamDestroy = (event) => {
    const target = event.stream.streamId;
    setSubscribers((prevSubscribers) => {
      delete prevSubscribers[target];
      return { ...prevSubscribers };
    });
  };

  /* Connect to session */
  const connect = async () => {
    const myToken = await getToken();
    try {
      await session.current.connect(myToken, {
        clientData: myUserName.current,
      });
      await connectWebCam();
    } catch (e) {
      alert("There was an error connecting to the session:", e.message);
      throw e;
    }
  };

  /* Get session token */
  const getToken = async () => {
    const host =
      process.env.NODE_ENV && false === "development"
        ? "http://localhost:4000"
        : "http://pixie.neetos.com";

    try {
      const response = await fetch(`${host}/token?meetingUrl=${sessionId}`);
      const { token } = await response.json();
      return token;
    } catch (e) {
      throw e;
    }
  };

  /* Publish Video/Audio to session */
  const connectWebCam = async () => {
    setPublisher(
      OV.initPublisher(undefined, {
        audioSource: undefined,
        videoSource: undefined,
        publishAudio: isMicOn,
        publishVideo: isCameraOn,
        resolution: "1280x720",
        frameRate: 30,
        insertMode: "REPLACE",
      })
    );

    try {
      /* **Important**
      Need a check for if the camera/mic is on, this promise doesn't seem to resolve when camera & mic permissions are blocked */
      await session.current.publish(publisher);
    } catch (e) {
      throw e;
    }
  };

  /* Toggle Fullscreen (Need to determine aspect ratio) */
  const toggleFullscreen = () => {
    const document = window.document;
    if (
      !document.fullscreenElement &&
      !document.mozFullScreenElement &&
      !document.webkitFullscreenElement &&
      !document.msFullscreenElement
    ) {
      if (mainContainerRef.current.requestFullscreen) {
        mainContainerRef.current.requestFullscreen();
      } else if (mainContainerRef.current.msRequestFullscreen) {
        mainContainerRef.current.msRequestFullscreen();
      } else if (mainContainerRef.current.mozRequestFullScreen) {
        mainContainerRef.current.mozRequestFullScreen();
      } else if (mainContainerRef.current.webkitRequestFullscreen) {
        mainContainerRef.current.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  };

  const camStatusChanged = () => {
    setIsCameraOn((prev) => !prev);
  };

  const micStatusChanged = () => {
    setIsMicOn((prev) => !prev);
  };

  /* Leave session */
  const leaveSession = () => {
    session && session.current.disconnect();
    // Clear Properties
    // @TODO update OV context value
    session.current = undefined;
    setSubscribers({});
    setPublisher(undefined);
  };

  return (
    <div className="container" id="main-container" ref={mainContainerRef}>
      {publisher && (
        <>
          <Toolbar
            stream={publisher}
            camStatusChanged={camStatusChanged}
            micStatusChanged={micStatusChanged}
            toggleFullscreen={toggleFullscreen}
            leaveSession={leaveSession}
            isMicOn={isMicOn}
            isCameraOn={isCameraOn}
            sessionId={sessionId}
          />
          {showVideoContainer && (
            <Videos
              stream={publisher}
              isMicOn={isMicOn}
              isCameraOn={isCameraOn}
              subscribers={subscribers}
            />
          )}
        </>
      )}
    </div>
  );
}