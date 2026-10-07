export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('https://')) {
    return {
      format: 'module',
      shortCircuit: true,
      url: `data:text/javascript,
        export class Midi {
          constructor() {
            this.tempo = 120;
            this.tracks = [];
            this.header = {
              setTempo: (bpm) => { this.tempo = bpm; }
            };
          }
          addTrack() {
            const track = {
              instrument: {},
              channel: 0,
              notes: [],
              addNote: (note) => { track.notes.push(note); }
            };
            this.tracks.push(track);
            return track;
          }
          toArray() {
            return new Uint8Array([1, 2, 3]);
          }
        }
      `
    };
  }
  return nextResolve(specifier, context);
}
