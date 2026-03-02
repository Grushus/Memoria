# Memoria

***Built solo with the help of Claude Code for the Mistral AI Hackathon.***

A real world photo journal and collector app. You point your camera at something; an animal, a plant, a landmark, a food and Mistral's vision AI identifies it, logs it to a global registry, and tells you whether you're the first person in the world to capture it.

The core hook is discovery competition: every identified entry has a global catch count, and the first 1000 people to log it earn permanent discovery badges (First discoverer, First 10, First 100, First 1000). Rarity tiers shift as more people find the same thing, a Legendary spider today might be Epic next month. The index is ever expanding (within the defined categories) and new entries are automatically made when something new is captured.

Beyond the discovery competition is also the general purpose feeling the app has by helping you identify objects & things you're unsure of what they are. Each entry also comes with an automatic description and a fun fact about the captured object as well as an "Endangered" information if it detects what you've photographed is Endangered (Haven't been able to test this though). 

How it works: Each photo is unique and taken in the app. No photos can be uploaded. Each entry either gets tagged with; **identified** (named specific thing, goes to the global index), **gallery** (recognisable type but too generic to name, personal only) **rejected** (out of scope, not logged at all). Not happy with the label for your entry? You can manually re-label and the AI re-evaluates and take your input into consideration.

### Plans for the future and where I want this going:

- **Challengs**: Daily, weekly, monthly, yearly, lifetime goals to keep people coming back. Example of lifetime goal: *Visit the Eiffel Tower*

- **Streaks**: Log an entry every day to keep your streak going.

- **Map view**: See your catches plotted geographically (and others if they turn it on).

- **Friend System**: Find people who are into the same things as you are via the global indexes and send them a friend request, or people who have visisted a landmark you want to visit and ask them how it was!

- **Bucket list**: Less on the photographic vibe, but a bucketlist system where you can find people with the same bucketlist goals as you, to do things together!

- **Voting/Ranking**: Community curation of entires (flag duplicates, wrong entries, better quality photos appear on top of different indexes).

- **Upload photos**: Upload photos to your profile. Share who you are and your personality with the world.

- **Fine tuning**: Log outputs over time, fine tune to improve on user corrected labels to improve identification accuracy

### Models used:
- Pixtral-12b (Vision + Classification (Image > Entry Type, Name, Category, Subcategory, 
- Ministral-8b (Text generation, name + description + fun fact)
- Voxtral (For TTS)

### Tech Stack:
- React Native
- Supabase
- Mistral API
- Expo Camera
- Expo Location

## Want to try it yourself?
Prerequisites:
- Node.js 18+
- Expo CLI (npm install -g expo-cli)
- Android device or emulator (If using emulator, be aware the photos take a while to be processed)
- Supabase account
- Mistral API key

1. Clone the repository
- git clone https://github.com/Grushus/Memoria
- cd memoria

2. Install dependencies
- npm install

3. Create a supabase project at supabase.com
- Run supabase/schema.sql
- Create a storage bucket called catches and set it to public
- Go back in supabase/schema.sql, scroll to the bottom and run the commented out section after creating the storage bucket.
- Run supabase/trigger_new_user.sql

4. Add environment variables
- Create .env.local file in the root:
- EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
- EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
- EXPO_PUBLIC_MISTRAL_API_KEY=your_mistral_api_key
- EXPO_PUBLIC_VOXTRAL_API_KEY=your_mistral_api_key

5. Start the app (Go to settings > About Phone > Tap Build number / Version Number 7 times to activate developer mode > Settings > Developer Options > Turn on USB Debugging > Plug Phone into PC via USB > npm run android (should detect your device automatically). If that doesn't work then here's what I tried:
- npx expo install @expo/ngrok
- npx expo start --tunnel (I had a bit of problem myself but this & "npx expo install @expo/ngrok" is what worked for me)
- Other solutions could be:
- - npx expo run:android (build the actual app, takes 10-15 minutes)
  - npx expo start --android
  - npx expo start --android --lan
- Emulator route (Most of the app will be useless though because you will only be able to take images in the VR world you're in. But can still get a feel for UI and stuff):
- - Download Android studio
  - Open > More Actions > Virtual Device Manager
  - Pick a device
  - Start the emulator
  - npm run android

# ![Memoria Demo]((https://youtube.com/shorts/cESj0iES9N4?feature=share)) (Youtube link)
- Music used:
- - Music: I like you by Sakura Girl https://soundcloud.com/sakuragirl_official
  - License: Creative Commons — Attribution 3.0 Unported — CC BY 3.0
  - Free Download / Stream: https://audiolibrary.com.co/sakura-girl/i-like-you
  - Music promoted by Audio Library: https://youtu.be/NIlzYKUJabs
