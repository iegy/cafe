// دومنو الصحبة — إعداد WebRTC ICE/TURN
// ملاحظة: لأن الموقع Static على GitHub Pages، بيانات TURN الموجودة هنا تكون قابلة للقراءة من المتصفح.
export const turnConfig = {
  iceServers: [
    { urls: "stun:stun.relay.metered.ca:80" },
    {
      urls: "turn:global.relay.metered.ca:80",
      username: "26a42a49eeb173c84461106e",
      credential: "R1mLavPX5lTsOvBA"
    },
    {
      urls: "turn:global.relay.metered.ca:80?transport=tcp",
      username: "26a42a49eeb173c84461106e",
      credential: "R1mLavPX5lTsOvBA"
    },
    {
      urls: "turn:global.relay.metered.ca:443",
      username: "26a42a49eeb173c84461106e",
      credential: "R1mLavPX5lTsOvBA"
    },
    {
      urls: "turns:global.relay.metered.ca:443?transport=tcp",
      username: "26a42a49eeb173c84461106e",
      credential: "R1mLavPX5lTsOvBA"
    }
  ]
};
