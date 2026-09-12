# flybrowser

A simulated fly circuit learns a small browser task: search for a fruit, choose it, and select its ripeness. The Next.js app replays a recorded run with a 3D fly and a neuron activity map.

## Run the app

Use Node.js 24.18+ and npm. The video, scene and replay data are included; no API keys or Python setup are needed for the website.

```sh
npm ci
npm run dev
```

Open [localhost:3026](http://localhost:3026). `npm run build` and `npm start` run the production build; `npm run lint` checks the app.

```text
apps/web/              Next.js app, replay assets and demo video
packages/experiment/   Model, browser task, checkpoints, data and results
media/post.txt         Draft X post and replies
NOTICE                 Sources, modifications and credits
```

## What learned?

The model uses 5,187 neurons from MaleCNS v1.0. Training adjusts gains on 61,210 existing Kenyon-cell → MBON connections using 1,200 browser rewards and 300 gradient updates. Input and output mappings stay frozen. Stagehand's Chrome extension executes the selected actions.

| Condition | Successful episodes |
| --- | ---: |
| Random actions | 4/200 |
| Before training | 18/200 |
| Trained connections | 200/200 |
| Reset connections | 18/200 |
| Shuffled wiring, trained | 200/200 |

These are fresh seeds with a fixed vocabulary and engineered text inputs. Shuffled wiring also learns, so this demonstrates internal learning, not an anatomical advantage or general browser ability. Neuron activity comes from the rate simulation; the fly's legs are animated.

[Results chart](packages/experiment/artifacts/performance.png) · [Learning curve](packages/experiment/artifacts/learning-curve.png) · [Audit](packages/experiment/artifacts/plastic/audit.json) · [Video](apps/web/public/assets/fly-browser-demo.mp4)

## Reproduce the experiment

Install [uv](https://docs.astral.sh/uv/), then run:

```sh
npm run experiment:setup        # Python 3.12, circuit checks, checkpoint restore
npm run experiment:audit        # Verify weights and 1,812 recorded decisions
npm run experiment:browser      # Build pinned Stagehand + fetch Flybody
npm run experiment:train
npm run experiment:train:shuffled
npm run experiment:evaluate     # 200 live browser episodes per condition
npm run experiment:evals        # Stagehand CLI: 16 additional smoke episodes
```

Browser runs need local Chrome. Commands replace their corresponding experiment outputs. `experiment:collect` recollects rewards; `experiment:record`, `experiment:charts` and `experiment:export` regenerate presentation assets. With the app running and FFmpeg installed, `experiment:video` renders the 18-second film. `experiment:pack` updates the compressed checkpoints after training.

The reduced circuit is included. Optional `experiment:rebuild-data` downloads approximately 1.1 GB of original data and rebuilds it. Source commits, checksums and evaluation settings live beside the data in JSON.

Built with [MaleCNS](https://male-cns.janelia.org/download/), [Flyhard](https://github.com/MarkUnthank/flyhard), [Flybody](https://github.com/TuragaLab/flybody) and [Stagehand](https://github.com/browserbase/stagehand). See [NOTICE](NOTICE) for attribution and third-party licenses; MaleCNS-derived data is CC BY 4.0.
