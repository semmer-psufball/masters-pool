import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ImageBackground, Image, StyleSheet, StatusBar, ActivityIndicator, RefreshControl, Platform, Modal, TextInput, FlatList } from 'react-native';
import { useFonts, PlayfairDisplay_400Regular, PlayfairDisplay_400Regular_Italic, PlayfairDisplay_500Medium, PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { CormorantGaramond_400Regular, CormorantGaramond_500Medium, CormorantGaramond_600SemiBold, CormorantGaramond_700Bold, CormorantGaramond_400Regular_Italic } from '@expo-google-fonts/cormorant-garamond';
import { SourceSerif4_400Regular, SourceSerif4_500Medium, SourceSerif4_600SemiBold, SourceSerif4_700Bold } from '@expo-google-fonts/source-serif-4';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { COLORS, FONTS, NAME_FONTS, NUM_FONTS, UI_FONTS, IMAGES, POOL_MEMBERS, AUCTION, SCORING, DRAFT_SCHEDULE, FREE_AGENCY } from './src/constants/theme';
import { calculatePoolStandings, calculateGolferPoints } from './src/services/scoring';
import { getLeaderboard, getMastersField, getPlayerProfile } from './src/services/espn';
import { signInAnon, setupProfile, logOut, onAuthChange, onUserProfile, addFavorite, removeFavorite, onPoolConfig, onDraftPicks, submitBid, withdrawBid, submitProposal, updateProposalBid, onRoundProposals, onRoundBids, claimFreeAgent, onFreeAgencyClaims } from './src/services/firebase';
import { registerForPushNotifications } from './src/services/notifications';

const TOP_PAD = Platform.OS === 'ios' ? 54 : 36;


function sc(s) { if (s === 0 || s === 'E') return 'E'; if (typeof s === 'number') return s < 0 ? `${s}` : `+${s}`; return s; }
function shortName(name) { if (!name) return ''; const parts = name.split(' '); return parts.length > 1 ? parts[0].charAt(0) + '. ' + parts.slice(1).join(' ') : name; }
function sColor(s) { if (s === 'E' || s === 0) return COLORS.evenPar; const n = typeof s === 'number' ? s : parseInt(s); return isNaN(n) ? COLORS.cream : n < 0 ? COLORS.underPar : COLORS.overPar; }

// ═══════════════════════════════════════
// MASTERS FIELD (pre-tournament fallback)
// ═══════════════════════════════════════
// Official 2026 Masters field — from masters.com
const MASTERS_FIELD = [
  { name: 'Ludvig Åberg', espnId: '4375972' },
  { name: 'Daniel Berger', espnId: '9025' },
  { name: 'Akshay Bhatia', espnId: '4419142' },
  { name: 'Keegan Bradley', espnId: '4513' },
  { name: 'Michael Brennan', espnId: '4921329' },
  { name: 'Jacob Bridgeman', espnId: '5054388' },
  { name: 'Sam Burns', espnId: '9938' },
  { name: 'Ángel Cabrera', espnId: '65' },
  { name: 'Brian Campbell', espnId: '9525' },
  { name: 'Patrick Cantlay', espnId: '6007' },
  { name: 'Wyndham Clark', espnId: '11119' },
  { name: 'Corey Conners', espnId: '9126' },
  { name: 'Fred Couples', espnId: '91' },
  { name: 'Jason Day', espnId: '1680' },
  { name: 'Bryson DeChambeau', espnId: '10046' },
  { name: 'Nico Echavarria', espnId: '4408316' },
  { name: 'Harris English', espnId: '5408' },
  { name: 'Ethan Fang', espnId: '5293232', amateur: true },
  { name: 'Matt Fitzpatrick', espnId: '9037' },
  { name: 'Tommy Fleetwood', espnId: '5539' },
  { name: 'Ryan Fox', espnId: '4251' },
  { name: 'Sergio García', espnId: '158' },
  { name: 'Ryan Gerard', espnId: '5076021' },
  { name: 'Chris Gotterup', espnId: '4690755' },
  { name: 'Max Greyserman', espnId: '11101' },
  { name: 'Ben Griffin', espnId: '4404992' },
  { name: 'Harry Hall', espnId: '4589438' },
  { name: 'Brian Harman', espnId: '1225' },
  { name: 'Tyrrell Hatton', espnId: '5553' },
  { name: 'Russell Henley', espnId: '5409' },
  { name: 'Jackson Herrington', espnId: null, amateur: true },
  { name: 'Nicolai Højgaard', espnId: '11250' },
  { name: 'Rasmus Højgaard', espnId: '11253' },
  { name: 'Brandon Holtz', espnId: null, amateur: true },
  { name: 'Max Homa', espnId: '8973' },
  { name: 'Viktor Hovland', espnId: '4364873' },
  { name: 'Mason Howell', espnId: '5289811', amateur: true },
  { name: 'Sungjae Im', espnId: '11382' },
  { name: 'Casey Jarvis', espnId: '4610056' },
  { name: 'Dustin Johnson', espnId: '3448' },
  { name: 'Zach Johnson', espnId: '686' },
  { name: 'Naoyuki Kataoka', espnId: '4837226' },
  { name: 'John Keefer', espnId: null },
  { name: 'Michael Kim', espnId: '8974' },
  { name: 'Si Woo Kim', espnId: '7081' },
  { name: 'Kurt Kitayama', espnId: '10364' },
  { name: 'Jake Knapp', espnId: '9843' },
  { name: 'Brooks Koepka', espnId: '6798' },
  { name: 'Fifa Laopakdee', espnId: '5327297', amateur: true },
  { name: 'Min Woo Lee', espnId: '4410932' },
  { name: 'Haotong Li', espnId: '9221' },
  { name: 'Shane Lowry', espnId: '4587' },
  { name: 'Robert MacIntyre', espnId: '11378' },
  { name: 'Hideki Matsuyama', espnId: '5860' },
  { name: 'Matt McCarty', espnId: '4901368' },
  { name: 'Rory McIlroy', espnId: '3470' },
  { name: 'Tom McKibbin', espnId: '4348444' },
  { name: 'Maverick McNealy', espnId: '9530' },
  { name: 'Collin Morikawa', espnId: '10592' },
  { name: 'Rasmus Neergaard-Petersen', espnId: '4858859' },
  { name: 'Alex Noren', espnId: '3832' },
  { name: 'Andrew Novak', espnId: '11332' },
  { name: 'José María Olazábal', espnId: '329' },
  { name: 'Carlos Ortiz', espnId: '5532' },
  { name: 'Marco Penge', espnId: '4585549' },
  { name: 'Aldrich Potgieter', espnId: '5080439' },
  { name: 'Mateo Pulcini', espnId: null, amateur: true },
  { name: 'Jon Rahm', espnId: '9780' },
  { name: 'Aaron Rai', espnId: '10906' },
  { name: 'Patrick Reed', espnId: '5579' },
  { name: 'Kristoffer Reitan', espnId: '4348470' },
  { name: 'Davis Riley', espnId: '10058' },
  { name: 'Justin Rose', espnId: '569' },
  { name: 'Xander Schauffele', espnId: '10140' },
  { name: 'Scottie Scheffler', espnId: '9478' },
  { name: 'Charl Schwartzel', espnId: '1097' },
  { name: 'Adam Scott', espnId: '388' },
  { name: 'Vijay Singh', espnId: '392' },
  { name: 'Cameron Smith', espnId: '9131' },
  { name: 'J.J. Spaun', espnId: '10166' },
  { name: 'Jordan Spieth', espnId: '5467' },
  { name: 'Samuel Stevens', espnId: null },
  { name: 'Sepp Straka', espnId: '8961' },
  { name: 'Nick Taylor', espnId: '3792' },
  { name: 'Justin Thomas', espnId: '4848' },
  { name: 'Sami Välimäki', espnId: '4585548' },
  { name: 'Bubba Watson', espnId: '780' },
  { name: 'Mike Weir', espnId: '453' },
  { name: 'Danny Willett', espnId: '4304' },
  { name: 'Gary Woodland', espnId: '3550' },
  { name: 'Cameron Young', espnId: '4425906' },
];

// Local headshots for players without ESPN IDs
const LOCAL_HEADSHOTS = {
  'Michael Brennan': require('./assets/images/headshots/michael_brennan.png'),
  'Jackson Herrington': require('./assets/images/headshots/jackson_herrington.png'),
  'Brandon Holtz': require('./assets/images/headshots/brandon_holtz.png'),
  'Naoyuki Kataoka': require('./assets/images/headshots/naoyuki_kataoka.png'),
  'John Keefer': require('./assets/images/headshots/john_keefer.png'),
  'Fifa Laopakdee': require('./assets/images/headshots/fifa_laopakdee.png'),
  'Mateo Pulcini': require('./assets/images/headshots/mateo_pulcini.png'),
  'Samuel Stevens': require('./assets/images/headshots/samuel_stevens.png'),
};

// Helper to get headshot for any player by name
// Returns a URI string (ESPN) or a local require() (bundled)
// Local headshots take priority — ESPN may 404 for lesser-known players
function getHeadshotUrl(playerName) {
  const local = LOCAL_HEADSHOTS[playerName];
  if (local) return local;
  const field = MASTERS_FIELD.find(f => f.name.toLowerCase() === (playerName || '').toLowerCase());
  if (field?.espnId) return `https://a.espncdn.com/i/headshots/golf/players/full/${field.espnId}.png`;
  return null;
}

// Helper to get Image source prop (handles both URI strings and require() numbers)
function headshotSource(hs) {
  if (!hs) return null;
  if (typeof hs === 'number') return hs; // local require()
  return { uri: hs }; // remote URL
}

// Headshot with fallback silhouette on error/null
function HeadshotImage({ source, style, name }) {
  const [errored, setErrored] = useState(false);
  const src = headshotSource(source);
  if (!src || errored) {
    const size = StyleSheet.flatten(style)?.width || 48;
    return (
      <View style={[style, { backgroundColor: COLORS.lightGreen, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontFamily: NAME_FONTS.semiBold, fontSize: size * 0.42, color: COLORS.softGold }}>{(name || '?').charAt(0)}</Text>
      </View>
    );
  }
  return <Image source={src} style={style} onError={() => setErrored(true)} />;
}

// Small member avatar circle: photo if available, else first initial
function MemberAvatar({ member, size = 28 }) {
  const radius = size / 2;
  if (member.photo) {
    return <Image source={member.photo} style={{ width: size, height: size, borderRadius: radius, marginRight: 8, backgroundColor: COLORS.cardBgHover }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: radius, marginRight: 8, backgroundColor: COLORS.cardBgHover, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: NAME_FONTS.semiBold, fontSize: size * 0.5, color: COLORS.softGold }}>{(member.first || '?').charAt(0)}</Text>
    </View>
  );
}

// ═══════════════════════════════════════
// WELCOME / LOGIN SCREEN
// ═══════════════════════════════════════
function WelcomeScreen({ userName, onEnter }) {
  return (
    <ImageBackground source={IMAGES.bridge} style={{ flex: 1 }} resizeMode="cover">
      <View style={ws.overlay}>
        <View style={ws.center}>
          <Text style={ws.heading}>Welcome to Augusta,</Text>
          <Text style={ws.name}>{userName}!</Text>
        </View>
        <View style={ws.bottom}>
          <TouchableOpacity style={ws.enterBtn} onPress={onEnter} activeOpacity={0.8}>
            <Text style={ws.enterText}>Enter</Text>
          </TouchableOpacity>
          <Text style={ws.year}>The 2026 Masters Pool</Text>
        </View>
      </View>
    </ImageBackground>
  );
}

function SetupScreen({ uid }) {
  const [email, setEmail] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selectedMember) { setError('Select who you are'); return; }
    setError('');
    setLoading(true);
    try {
      await setupProfile(uid, { firstName: selectedMember.first, lastName: selectedMember.last, email: email.trim(), poolMemberId: selectedMember.id });
    } catch (e) {
      setError('Something went wrong. Try again.');
    }
    setLoading(false);
  };

  return (
    <ImageBackground source={IMAGES.bridge} style={{ flex: 1 }} resizeMode="cover">
      <View style={ws.overlay}>
        <ScrollView contentContainerStyle={ws.loginContainer} keyboardShouldPersistTaps="handled">
          <Text style={ws.loginTitle}>The Masters Pool</Text>
          <Text style={ws.loginSubtitle}>Set up your profile</Text>

          <TextInput style={ws.inputWhite} placeholder="Email" placeholderTextColor="rgba(0,0,0,0.35)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

          <Text style={ws.memberLabel}>Who are you?</Text>
          <View style={ws.memberGrid}>
            {POOL_MEMBERS.map(m => (
              <TouchableOpacity key={m.id} style={[ws.memberBtnWhite, selectedMember?.id === m.id && ws.memberBtnActive]} onPress={() => setSelectedMember(m)} activeOpacity={0.7}>
                <Text style={[ws.memberBtnTextWhite, selectedMember?.id === m.id && ws.memberBtnTextActive]}>{m.first} {m.last}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {error ? <Text style={ws.error}>{error}</Text> : null}

          <TouchableOpacity style={ws.enterBtn} onPress={handleSubmit} activeOpacity={0.8} disabled={loading}>
            {loading ? <ActivityIndicator color="#2A5E3F" /> : <Text style={ws.enterText}>Let's Go</Text>}
          </TouchableOpacity>

          <Text style={ws.year}>The 2026 Masters Pool</Text>
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const ws = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,40,20,0.55)', paddingTop: TOP_PAD },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  heading: { fontFamily: FONTS.bold, fontSize: 26, color: COLORS.gold, letterSpacing: 2, textAlign: 'center' },
  name: { fontFamily: FONTS.bold, fontSize: 44, color: COLORS.gold, textAlign: 'center' },
  bottom: { alignItems: 'center', paddingBottom: 60 },
  enterBtn: { paddingVertical: 12, paddingHorizontal: 44, backgroundColor: COLORS.gold, borderRadius: 30, alignSelf: 'center' },
  enterText: { fontFamily: FONTS.bold, fontSize: 22, color: '#2A5E3F', letterSpacing: 3, textTransform: 'uppercase' },
  year: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.gold, marginTop: 24, letterSpacing: 2, textAlign: 'center' },
  // Login
  loginContainer: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 30, paddingBottom: 40 },
  loginTitle: { fontFamily: FONTS.bold, fontSize: 32, color: COLORS.gold, textAlign: 'center', marginBottom: 6 },
  loginSubtitle: { fontFamily: UI_FONTS.medium, fontSize: 15, color: COLORS.softGold, textAlign: 'center', marginBottom: 28 },
  inputWhite: { fontFamily: UI_FONTS.regular, fontSize: 16, color: '#333', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16 },
  memberLabel: { fontFamily: UI_FONTS.medium, fontSize: 14, color: COLORS.gold, marginBottom: 10, textAlign: 'center' },
  memberGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 20 },
  memberBtnWhite: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12, backgroundColor: '#fff' },
  memberBtnActive: { backgroundColor: COLORS.gold },
  memberBtnTextWhite: { fontFamily: UI_FONTS.semiBold, fontSize: 14, color: '#333' },
  memberBtnTextActive: { color: '#2A5E3F' },
  error: { fontFamily: UI_FONTS.regular, fontSize: 13, color: COLORS.overPar, textAlign: 'center', marginBottom: 12 },
});

// ═══════════════════════════════════════
// TAB BAR
// ═══════════════════════════════════════
const TABS = ['Board', 'Pool', 'Draft', 'Players'];
function TabBar({ active, onPress }) {
  return (
    <View style={tb.bar}>
      {TABS.map((t, i) => (
        <TouchableOpacity key={t} onPress={() => onPress(i)} style={tb.item}>
          <Text style={[tb.text, active === i && tb.textActive]}>{t}</Text>
          {active === i && <View style={tb.indicator} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}
const tb = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: COLORS.darkGreen, borderBottomWidth: 1, borderBottomColor: COLORS.divider, paddingHorizontal: 8 },
  item: { flex: 1, alignItems: 'center', paddingVertical: 13 },
  text: { fontFamily: NAME_FONTS.bold, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(200,184,138,0.35)' },
  textActive: { color: COLORS.azaleaPink },
  indicator: { position: 'absolute', bottom: 0, width: 28, height: 2.5, backgroundColor: COLORS.azaleaPink, borderRadius: 1 },
});

// ═══════════════════════════════════════
// PLAYER DETAIL MODAL
// ═══════════════════════════════════════
function PlayerDetailModal({ visible, onClose, player }) {
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    if (visible && player) {
      setLoadingProfile(true);
      setProfile(null);
      if (player.espnId || player.id) {
        getPlayerProfile(player.espnId || player.id).then(data => {
          setProfile(data);
          setLoadingProfile(false);
        }).catch(() => setLoadingProfile(false));
      } else {
        setLoadingProfile(false);
      }
    }
  }, [visible, player]);

  if (!player) return null;

  const fieldData = MASTERS_FIELD.find(f => f.name.toLowerCase() === (player.name || '').toLowerCase());

  // Pull real season stats from ESPN profile
  const seasonStats = {};
  if (profile?.statistics) {
    const names = profile.statistics.names || [];
    const splits = profile.statistics.splits || [];
    const tourSplit = splits.find(s => (s.displayName || '').includes('PGA')) || splits[0];
    if (tourSplit?.stats) {
      names.forEach((name, i) => {
        if (tourSplit.stats[i] != null) seasonStats[name] = tourSplit.stats[i];
      });
    }
  }

  // Pull real rankings from ESPN profile
  const rankings = {};
  if (profile?.seasonRankings?.categories) {
    profile.seasonRankings.categories.forEach(cat => {
      if (cat.displayName && cat.value != null && cat.value !== '?') {
        rankings[cat.displayName] = cat.value;
      }
    });
  }

  // Thru display: empty or "-" = "F" (finished), otherwise show value
  const thruDisplay = (!player.thru || player.thru === '-' || player.thru === '') ? 'F' : player.thru;

  // Combine season stats + rankings into one curated list
  const combinedStats = [];
  // From season stats (parallel array)
  const statMap = { 'Tournaments Played': 'Tournaments', 'Cuts Made': 'Cuts Made', 'Top Ten': 'Top 10s', 'Wins': 'Wins', 'Scoring Average': 'Scoring Avg', 'Earnings': 'Earnings' };
  Object.entries(statMap).forEach(([key, label]) => {
    if (seasonStats[key] != null) combinedStats.push({ label, value: String(seasonStats[key]) });
  });
  // From rankings
  const rankMap = {
    'Birdies per round': 'Birdies/Round',
    'Driving distance (in yards)': 'Driving Dist',
    'Driving accuracy %': 'Driving Acc %',
    'Putts per GIR': 'Putts/GIR',
  };
  Object.entries(rankMap).forEach(([key, label]) => {
    if (rankings[key] != null && rankings[key] !== '?') {
      const val = rankings[key];
      const display = typeof val === 'number' ? (label.includes('%') ? val.toFixed(1) + '%' : val.toFixed(1)) : String(val);
      combinedStats.push({ label, value: display });
    }
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={pd.overlay}>
        <View style={pd.sheet}>
          <ScrollView showsVerticalScrollIndicator={false} bounces={true}>
            <View style={pd.playerHeader}>
              {player.headshot ? (
                <Image source={headshotSource(player.headshot)} style={pd.headshot} />
              ) : (
                <View style={pd.headshotPlaceholder}>
                  <Text style={pd.headshotInitial}>{(player.name || '?').charAt(0)}</Text>
                </View>
              )}
              <View style={pd.nameBlock}>
                <Text style={pd.name}>{player.name}</Text>
                {player.country ? (
                  <View style={pd.countryRow}>
                    {player.flagUrl && <Image source={{ uri: player.flagUrl }} style={pd.flag} />}
                    <Text style={pd.country}>{player.country}</Text>
                  </View>
                ) : null}
              </View>
              <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={pd.doneBtn}>
                <Text style={pd.doneText}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Tournament position */}
            {(player.positionDisplay || player.totalScoreNum !== undefined) && (
              <View style={pd.posRow}>
                <View style={pd.posStat}>
                  <Text style={pd.posValue}>{player.positionDisplay || '-'}</Text>
                  <Text style={pd.posLabel}>Position</Text>
                </View>
                <View style={pd.posStat}>
                  <Text style={[pd.posValue, { color: sColor(player.totalScoreNum ?? 0) }]}>{sc(player.totalScoreNum ?? 0)}</Text>
                  <Text style={pd.posLabel}>Total</Text>
                </View>
                <View style={pd.posStat}>
                  <Text style={pd.posValue}>{thruDisplay}</Text>
                  <Text style={pd.posLabel}>Thru</Text>
                </View>
              </View>
            )}

            {/* Round scores */}
            {player.rounds && player.rounds.length > 0 && (
              <View style={pd.section}>
                <Text style={pd.sectionTitle}>Round Scores</Text>
                <View style={pd.roundsRow}>
                  {player.rounds.map((r, i) => (
                    <View key={i} style={pd.roundBox}>
                      <Text style={pd.roundLabel}>R{i + 1}</Text>
                      <Text style={[pd.roundVal, { color: sColor(r?.toPar === 'E' ? 0 : parseInt(r?.toPar) || 0) }]}>{r?.toPar && r.toPar !== '-' ? r.toPar : (r?.strokes || '-')}</Text>
                      {r?.strokes && r.strokes !== '-' && r?.toPar && r.toPar !== '-' && <Text style={pd.roundToPar}>({r.strokes})</Text>}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Hole-by-hole for current round */}
            {(() => {
              const latestRound = player.rounds && player.rounds.length > 0
                ? player.rounds[player.rounds.length - 1]
                : null;
              const holes = latestRound?.holes || [];
              if (holes.length === 0) return null;
              const front9 = holes.filter(h => h.hole >= 1 && h.hole <= 9).sort((a, b) => a.hole - b.hole);
              const back9 = holes.filter(h => h.hole >= 10 && h.hole <= 18).sort((a, b) => a.hole - b.hole);
              const holeColor = (tp) => {
                if (!tp || tp === 'E') return COLORS.cream;
                const n = parseInt(tp);
                if (isNaN(n)) return COLORS.cream;
                if (n <= -2) return '#4AE86B';
                if (n < 0) return COLORS.fairwayGreen;
                return COLORS.overPar;
              };
              const holeBg = (tp) => {
                if (!tp || tp === 'E') return 'transparent';
                const n = parseInt(tp);
                if (isNaN(n)) return 'transparent';
                if (n <= -2) return 'rgba(74, 232, 107, 0.15)';
                if (n < 0) return 'rgba(124, 219, 142, 0.12)';
                return 'rgba(232, 160, 122, 0.12)';
              };
              return (
                <View style={pd.section}>
                  <Text style={pd.sectionTitle}>Current Round — Hole by Hole</Text>
                  <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                    {[1,2,3,4,5,6,7,8,9].map(n => {
                      const h = front9.find(x => x.hole === n);
                      return (
                        <View key={n} style={{ flex: 1, alignItems: 'center', paddingVertical: 6, marginHorizontal: 1, backgroundColor: h ? holeBg(h.toPar) : 'transparent', borderRadius: 6 }}>
                          <Text style={{ fontFamily: UI_FONTS.medium, fontSize: 9, color: COLORS.softGold, marginBottom: 3 }}>{n}</Text>
                          <Text style={{ fontFamily: NUM_FONTS.bold, fontSize: 14, color: h ? holeColor(h.toPar) : 'rgba(200,184,138,0.25)' }}>{h ? h.display : '-'}</Text>
                        </View>
                      );
                    })}
                  </View>
                  <View style={{ flexDirection: 'row' }}>
                    {[10,11,12,13,14,15,16,17,18].map(n => {
                      const h = back9.find(x => x.hole === n);
                      return (
                        <View key={n} style={{ flex: 1, alignItems: 'center', paddingVertical: 6, marginHorizontal: 1, backgroundColor: h ? holeBg(h.toPar) : 'transparent', borderRadius: 6 }}>
                          <Text style={{ fontFamily: UI_FONTS.medium, fontSize: 9, color: COLORS.softGold, marginBottom: 3 }}>{n}</Text>
                          <Text style={{ fontFamily: NUM_FONTS.bold, fontSize: 14, color: h ? holeColor(h.toPar) : 'rgba(200,184,138,0.25)' }}>{h ? h.display : '-'}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })()}

            {/* Combined season stats */}
            {combinedStats.length > 0 && (
              <View style={pd.section}>
                <Text style={pd.sectionTitle}>Season Stats</Text>
                <View style={pd.sgGrid}>
                  {combinedStats.map((s, i) => (
                    <View key={i} style={pd.sgItem}>
                      <Text style={[pd.sgVal, { color: COLORS.cream }]}>{s.value}</Text>
                      <Text style={pd.sgLabel}>{s.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {loadingProfile && <ActivityIndicator color={COLORS.gold} style={{ marginTop: 16 }} />}
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const pd = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.darkGreen, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 16, paddingBottom: 40, maxHeight: '85%' },
  playerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  doneBtn: { paddingVertical: 6, paddingHorizontal: 2, marginLeft: 12 },
  doneText: { fontFamily: UI_FONTS.semiBold, fontSize: 15, color: COLORS.azaleaPink },
  headshot: { width: 68, height: 68, borderRadius: 34, marginRight: 16, backgroundColor: COLORS.cardBgHover },
  headshotPlaceholder: { width: 68, height: 68, borderRadius: 34, marginRight: 16, backgroundColor: COLORS.cardBgHover, alignItems: 'center', justifyContent: 'center' },
  headshotInitial: { fontFamily: NAME_FONTS.semiBold, fontSize: 28, color: COLORS.softGold },
  nameBlock: { flex: 1 },
  name: { fontFamily: NAME_FONTS.bold, fontSize: 24, color: COLORS.cream },
  countryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  flag: { width: 18, height: 13, marginRight: 6, borderRadius: 2 },
  country: { fontFamily: UI_FONTS.regular, fontSize: 14, color: COLORS.softGold },
  posRow: { flexDirection: 'row', marginBottom: 20, gap: 8 },
  posStat: { flex: 1, alignItems: 'center', paddingVertical: 14, backgroundColor: COLORS.cardBg, borderRadius: 10 },
  posValue: { fontFamily: NUM_FONTS.bold, fontSize: 22, color: COLORS.cream },
  posLabel: { fontFamily: UI_FONTS.medium, fontSize: 11, color: COLORS.softGold, letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 },
  section: { marginBottom: 20 },
  sectionTitle: { fontFamily: UI_FONTS.semiBold, fontSize: 12, color: COLORS.softGold, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 },
  roundsRow: { flexDirection: 'row', gap: 8 },
  roundBox: { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: COLORS.cardBg, borderRadius: 10 },
  roundLabel: { fontFamily: NUM_FONTS.semiBold, fontSize: 12, color: COLORS.softGold, marginBottom: 4 },
  roundVal: { fontFamily: NUM_FONTS.bold, fontSize: 20, color: COLORS.cream },
  roundToPar: { fontFamily: NUM_FONTS.regular, fontSize: 13, color: COLORS.softGold, marginTop: 2 },
  sgGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sgItem: { width: '47%', alignItems: 'center', paddingVertical: 12, backgroundColor: COLORS.cardBg, borderRadius: 10 },
  sgVal: { fontFamily: NUM_FONTS.bold, fontSize: 18 },
  sgLabel: { fontFamily: UI_FONTS.medium, fontSize: 11, color: COLORS.softGold, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 4 },
  projRow: { flexDirection: 'row', gap: 8 },
  projItem: { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: COLORS.cardBg, borderRadius: 10 },
  projVal: { fontFamily: NUM_FONTS.bold, fontSize: 17, color: COLORS.softGold },
  projLabel: { fontFamily: UI_FONTS.medium, fontSize: 10, color: COLORS.softGold, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 4 },
});

// ═══════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════
function MyTeamCard({ players, draftPicks, poolMemberId }) {
  if (!poolMemberId || !draftPicks || !draftPicks[poolMemberId]) return null;
  const picks = draftPicks[poolMemberId] || [];
  if (picks.length === 0) return null;

  const completedRounds = players.length > 0
    ? Math.max(...players.map(p => p.rounds?.length || 0))
    : 0;

  const golferData = picks.map(pick => {
    const onBoard = players.find(p =>
      p.name && pick.player && p.name.toLowerCase() === pick.player.toLowerCase()
    );
    if (!onBoard) return { name: pick.player, position: '-', score: '-', points: 0, headshot: getHeadshotUrl(pick.player) };
    const { total } = calculateGolferPoints(onBoard, players, completedRounds);
    return {
      name: onBoard.name,
      position: onBoard.positionDisplay || '-',
      score: onBoard.totalScoreNum,
      points: total,
      headshot: getHeadshotUrl(onBoard.name) || onBoard.headshot,
    };
  });

  const teamTotal = Math.round(golferData.reduce((s, g) => s + g.points, 0));

  return (
    <View style={mt.card}>
      <View style={mt.header}>
        <Text style={mt.title}>My Team</Text>
        <Text style={[mt.total, { color: teamTotal >= 0 ? COLORS.fairwayGreen : COLORS.overPar }]}>{teamTotal} pts</Text>
      </View>
      {golferData.map((g, i) => (
        <View key={i} style={mt.row}>
          {g.headshot ? (
            <Image source={headshotSource(g.headshot)} style={mt.headshot} />
          ) : (
            <View style={mt.headshotEmpty} />
          )}
          <Text style={mt.name} numberOfLines={1}>{shortName(g.name)}</Text>
          <Text style={mt.pos}>{g.position}</Text>
          <Text style={[mt.score, { color: typeof g.score === 'number' ? sColor(g.score) : COLORS.softGold }]}>
            {typeof g.score === 'number' ? sc(g.score) : g.score}
          </Text>
        </View>
      ))}
    </View>
  );
}

const mt = StyleSheet.create({
  card: { marginHorizontal: 14, marginTop: 8, marginBottom: 10, backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.subtleBorder },
  title: { fontFamily: UI_FONTS.semiBold, fontSize: 12, color: COLORS.softGold, letterSpacing: 1.5, textTransform: 'uppercase' },
  total: { fontFamily: NUM_FONTS.bold, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  headshot: { width: 24, height: 24, borderRadius: 12, marginRight: 8, backgroundColor: COLORS.cardBgHover },
  headshotEmpty: { width: 24, height: 24, borderRadius: 12, marginRight: 8, backgroundColor: COLORS.cardBgHover },
  name: { flex: 1, fontFamily: NAME_FONTS.semiBold, fontSize: 15, color: COLORS.cream },
  pos: { width: 36, fontFamily: NUM_FONTS.semiBold, fontSize: 13, color: COLORS.softGold, textAlign: 'center' },
  score: { width: 40, fontFamily: NUM_FONTS.bold, fontSize: 14, textAlign: 'right' },
});

// Build owner lookup from draft picks: playerName.lower -> { memberId, member }
function buildOwnerMap(draftPicks) {
  const map = {};
  Object.entries(draftPicks).forEach(([memberId, picks]) => {
    const member = POOL_MEMBERS.find(m => m.id === memberId);
    (picks || []).forEach(p => {
      map[p.player.toLowerCase()] = { memberId, member };
    });
  });
  return map;
}

// Owner badge for leaderboard
const MEMBER_COLORS = {
  semmer: '#4A90D9', loeb: '#E8A07A', marquis: '#7CDB8E',
  pearlman: '#D4729C', forde: '#9B8FE8',
};

function OwnerBadge({ memberId }) {
  const member = POOL_MEMBERS.find(m => m.id === memberId);
  if (!member) return null;
  return (
    <View style={{ backgroundColor: MEMBER_COLORS[memberId] || COLORS.softGold, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6 }}>
      <Text style={{ fontFamily: UI_FONTS.semiBold, fontSize: 9, color: '#fff', letterSpacing: 0.5 }}>{member.first}</Text>
    </View>
  );
}

function LeaderboardScreen() {
  const { profile } = React.useContext(UserContext);
  const [data, setData] = useState({ tournament: null, players: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [draftPicks, setDraftPicks] = useState({});

  useEffect(() => {
    const unsub = onDraftPicks((d) => { setDraftPicks(d.picks || {}); });
    return unsub;
  }, []);

  const fetchData = useCallback(async () => {
    const r = await getLeaderboard();
    setData(r);
    setLoading(false);
    setRefreshing(false);
  }, []);
  useEffect(() => { fetchData(); }, []);

  const hasLive = data.players.length > 0;
  // Show live leaderboard when ESPN has competitors AND the event isn't just "Scheduled"
  // ESPN uses: "Scheduled", "In Progress", "Final", "Completed", "Suspended", etc.
  const isTournament = data.players.length > 0 && data.tournament?.status && data.tournament.status !== 'Scheduled';
  const poolMemberId = profile?.poolMemberId || null;
  const hasDraftPicks = poolMemberId && draftPicks[poolMemberId] && draftPicks[poolMemberId].length > 0;
  const ownerMap = buildOwnerMap(draftPicks);

  // Pre-tournament: show full Masters field — "Field Preview"
  if (!isTournament) {
    return (
      <ScrollView style={lb.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={COLORS.gold} />}>
        {hasDraftPicks && <MyTeamCard players={data.players} draftPicks={draftPicks} poolMemberId={poolMemberId} />}

        <View style={lb.header}>
          <View style={{ width: 38 }} />
          <View style={{ width: 34 }} />
          <Text style={[lb.hText, { flex: 1 }]}>PLAYER</Text>
          <Text style={[lb.hText, { width: 50, textAlign: 'center' }]}>TODAY</Text>
          <Text style={[lb.hText, { width: 50, textAlign: 'center' }]}>THRU</Text>
          <Text style={[lb.hText, { width: 52, textAlign: 'center' }]}>TOTAL</Text>
        </View>

        {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginTop: 40 }} /> :
          MASTERS_FIELD.map((p, i) => {
            const owner = ownerMap[p.name.toLowerCase()];
            const hs = getHeadshotUrl(p.name);
            return (
              <TouchableOpacity key={i} style={[lb.row, i % 2 === 0 && lb.rowAlt]} activeOpacity={0.6} onPress={() => setSelectedPlayer({ name: p.name, espnId: p.espnId, headshot: hs })}>
                <Text style={lb.pos}>T1</Text>
                <HeadshotImage source={hs} style={lb.headshot} name={p.name} />
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={lb.name} numberOfLines={1}>{shortName(p.name)}{p.amateur ? ' (A)' : ''}</Text>
                  {owner && <OwnerBadge memberId={owner.memberId} />}
                </View>
                <Text style={[lb.today, { color: COLORS.cream }]}>-</Text>
                <Text style={[lb.thru, { color: COLORS.cream }]}>-</Text>
                <Text style={[lb.total, { color: COLORS.cream }]}>-</Text>
              </TouchableOpacity>
            );
          })}
        <View style={{ height: 40 }} />

        <PlayerDetailModal
          visible={!!selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          player={selectedPlayer}
        />
      </ScrollView>
    );
  }

  // Tournament in progress: Position / Name+headshot / Today / Thru / Total
  const players = data.players;

  return (
    <ScrollView style={lb.screen} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={COLORS.gold} />}>
      {hasDraftPicks && <MyTeamCard players={players} draftPicks={draftPicks} poolMemberId={poolMemberId} />}

      <View style={lb.header}>
        <View style={{ width: 38 }} />
        <View style={{ width: 34 }} />
        <Text style={[lb.hText, { flex: 1 }]}>PLAYER</Text>
        <Text style={[lb.hText, { width: 42, textAlign: 'center' }]}>TODAY</Text>
        <Text style={[lb.hText, { width: 42, textAlign: 'center' }]}>THRU</Text>
        <Text style={[lb.hText, { width: 46, textAlign: 'center' }]}>TOTAL</Text>
      </View>

      {players.map((p, i) => {
        const owner = ownerMap[(p.name || '').toLowerCase()];
        // Today's score: latest round's toPar, or "F" if finished
        const latestRound = p.rounds && p.rounds.length > 0 ? p.rounds[p.rounds.length - 1] : null;
        const todayScore = latestRound?.toPar || '-';
        // Thru: from ESPN data
        const thru = (!p.thru || p.thru === '-' || p.thru === '') ? 'F' : p.thru;
        const hs = getHeadshotUrl(p.name) || p.headshot;

        return (
          <TouchableOpacity key={i} style={[lb.row, i % 2 === 0 && lb.rowAlt, p.missedCut === true && lb.rowCut]} activeOpacity={0.6} onPress={() => setSelectedPlayer(p)}>
            <Text style={[lb.pos, i < 3 && !p.missedCut && lb.posTop, p.missedCut === true && lb.cutText]}>{p.positionDisplay || p.position}</Text>
            <HeadshotImage source={hs} style={lb.headshot} name={p.name} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[lb.name, p.missedCut === true && lb.cutName]} numberOfLines={1}>{shortName(p.name)}</Text>
                {owner && <OwnerBadge memberId={owner.memberId} />}
              </View>
            </View>
            <Text style={[lb.today, p.missedCut === true ? lb.cutText : { color: sColor(todayScore === 'F' ? 0 : todayScore) }]}>
              {todayScore === 'E' ? 'E' : todayScore}
            </Text>
            <Text style={[lb.thru, p.missedCut === true && lb.cutText]}>{p.missedCut ? 'MC' : thru}</Text>
            <Text style={[lb.total, p.missedCut === true ? lb.cutText : { color: sColor(p.totalScoreNum) }]}>{sc(p.totalScoreNum)}</Text>
          </TouchableOpacity>
        );
      })}
      <View style={{ height: 40 }} />

      <PlayerDetailModal
        visible={!!selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
        player={selectedPlayer}
      />
    </ScrollView>
  );
}
const lb = StyleSheet.create({
  screen: { flex: 1, paddingTop: 10 },
  previewBanner: { alignItems: 'center', paddingVertical: 8 },
  previewLabel: { fontFamily: UI_FONTS.semiBold, fontSize: 12, color: COLORS.softGold, letterSpacing: 2, textTransform: 'uppercase' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10, borderBottomWidth: 1.5, borderBottomColor: 'rgba(255,215,0,0.15)' },
  hText: { fontFamily: UI_FONTS.semiBold, fontSize: 11, color: COLORS.softGold, letterSpacing: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.subtleBorder },
  rowAlt: { backgroundColor: COLORS.azaleaGlow },
  pos: { width: 38, fontFamily: NUM_FONTS.semiBold, fontSize: 14, color: COLORS.softGold, textAlign: 'center' },
  posTop: { color: COLORS.gold },
  headshot: { width: 30, height: 30, borderRadius: 15, marginRight: 10, backgroundColor: COLORS.cardBgHover },
  name: { fontFamily: NAME_FONTS.semiBold, fontSize: 16, color: COLORS.cream },
  today: { width: 50, fontFamily: NUM_FONTS.bold, fontSize: 14, textAlign: 'center' },
  thru: { width: 50, fontFamily: NUM_FONTS.regular, fontSize: 13, color: COLORS.softGold, textAlign: 'center' },
  total: { width: 52, fontFamily: NUM_FONTS.bold, fontSize: 15, textAlign: 'center', color: COLORS.cream },
  rowCut: { opacity: 0.7 },
  cutName: { textDecorationLine: 'line-through', textDecorationColor: COLORS.overPar },
  cutText: { color: 'rgba(200,184,138,0.6)' },
});

// ═══════════════════════════════════════
// POOL — three states
// ═══════════════════════════════════════
function PoolScreen() {
  const [phase, setPhase] = useState('PRE_DRAFT');
  const [draftPicks, setDraftPicks] = useState({});

  useEffect(() => {
    const unsubConfig = onPoolConfig((config) => {
      setPhase(config.phase || 'PRE_DRAFT');
    });
    const unsubDraft = onDraftPicks((data) => {
      setDraftPicks(data.picks || {});
    });
    return () => { unsubConfig(); unsubDraft(); };
  }, []);

  if (phase === 'PRE_DRAFT') return <PoolPreDraft />;
  if (phase === 'DURING_DRAFT' || phase === 'FREE_AGENCY') return <PoolDuringDraft draftPicks={draftPicks} />;
  return <PoolTournament draftPicks={draftPicks} />;
}

function PoolPreDraft() {
  return (
    <ScrollView style={{ flex: 1, paddingTop: 10 }}>
      {POOL_MEMBERS.map((m) => (
        <View key={m.id} style={pl.card}>
          <View style={pl.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MemberAvatar member={m} size={28} />
              <View>
                <Text style={pl.memberName}>{m.first} {m.last}</Text>
                <Text style={pl.budget}>${AUCTION.totalBudget} · {AUCTION.rounds} picks</Text>
              </View>
            </View>
          </View>
        </View>
      ))}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function PoolDuringDraft({ draftPicks }) {
  const budgets = {};
  POOL_MEMBERS.forEach(m => { budgets[m.id] = AUCTION.totalBudget; });
  Object.entries(draftPicks).forEach(([id, picks]) => {
    (picks || []).forEach(p => { budgets[id] -= (p.price || 0); });
  });

  return (
    <ScrollView style={{ flex: 1, paddingTop: 10 }}>
      {POOL_MEMBERS.map((m) => {
        const picks = draftPicks[m.id] || [];
        const remaining = AUCTION.rosterSize - picks.length;
        return (
          <View key={m.id} style={pl.card}>
            <View style={pl.cardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <MemberAvatar member={m} size={28} />
                <View style={{ flex: 1 }}>
                  <Text style={pl.memberName}>{m.first} {m.last}</Text>
                  <Text style={pl.budget}>${budgets[m.id]} remaining · {remaining > 0 ? `${remaining} pick${remaining > 1 ? 's' : ''} needed` : 'Roster full'}</Text>
                </View>
              </View>
              <Text style={pl.pickCount}>{picks.length}/{AUCTION.rosterSize}</Text>
            </View>
            <View style={pl.picksList}>
              {picks.map((pick, j) => {
                const hs = getHeadshotUrl(pick.player);
                return (
                  <View key={j} style={pl.pickRow}>
                    <HeadshotImage source={hs} style={pl.pickHeadshot} name={pick.player} />
                    <Text style={pl.pickName}>{pick.player}</Text>
                    <Text style={pl.pickPrice}>${pick.price}</Text>
                    {pick.round && <Text style={{ fontFamily: UI_FONTS.regular, fontSize: 10, color: 'rgba(200,184,138,0.4)', marginLeft: 6 }}>R{pick.round}</Text>}
                  </View>
                );
              })}
              {Array.from({ length: remaining }, (_, j) => (
                <View key={`empty-${j}`} style={pl.emptySlot}>
                  <Text style={pl.emptyText}>Empty slot</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function PoolTournament({ draftPicks }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState({});

  const fetchData = useCallback(async () => {
    const r = await getLeaderboard();
    setLeaderboard(r.players || []);
    setLoading(false);
    setRefreshing(false);
  }, []);
  useEffect(() => { fetchData(); }, []);

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const completedRounds = leaderboard.length > 0
    ? Math.max(...leaderboard.map(p => p.rounds?.length || 0))
    : 0;

  const standings = calculatePoolStandings(POOL_MEMBERS, draftPicks, leaderboard, completedRounds);

  return (
    <ScrollView style={{ flex: 1, paddingTop: 10 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={COLORS.gold} />}>
      {/* Standings table */}
      <View style={pl.standingsCard}>
        <View style={pl.standingsHeader}>
          <Text style={[pl.standingsHText, { width: 28 }]}>#</Text>
          <Text style={[pl.standingsHText, { flex: 1 }]}>MEMBER</Text>
          <Text style={[pl.standingsHText, { width: 42, textAlign: 'right' }]}>PTS</Text>
          <Text style={[pl.standingsHText, { width: 42, textAlign: 'right' }]}>PROJ</Text>
          <Text style={[pl.standingsHText, { width: 42, textAlign: 'right' }]}>WIN%</Text>
        </View>
        {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginVertical: 20 }} /> :
          standings.map((m, i) => (
            <View key={m.id} style={[pl.standingsRow, i % 2 === 0 && pl.standingsRowAlt]}>
              <Text style={[pl.standingsRank, i < 3 && { color: COLORS.gold }]}>{i + 1}</Text>
              <MemberAvatar member={m} size={24} />
              <Text style={pl.standingsName}>{m.first} {m.last}</Text>
              <Text style={[pl.standingsPts, { color: m.teamPoints >= 0 ? COLORS.fairwayGreen : COLORS.overPar }]}>{m.teamPoints}</Text>
              <Text style={pl.standingsProj}>{m.teamProjected}</Text>
              <Text style={pl.standingsWin}>{m.winPct != null ? `${m.winPct}%` : '-'}</Text>
            </View>
          ))}
      </View>

      {/* Expandable member detail cards */}
      {!loading && standings.map((m, i) => {
        const isExpanded = expanded[m.id];
        return (
          <View key={m.id} style={pl.card}>
            <TouchableOpacity style={pl.cardHeader} onPress={() => toggleExpand(m.id)} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <MemberAvatar member={m} size={28} />
                <View style={{ flex: 1 }}>
                  <Text style={pl.memberName}>{m.first} {m.last}</Text>
                  <Text style={pl.teamScore}>
                    <Text style={{ color: m.teamPoints >= 0 ? COLORS.fairwayGreen : COLORS.overPar }}>{m.teamPoints} pts</Text>
                  </Text>
                </View>
              </View>
              <View style={pl.rankBadge}>
                <Text style={pl.rankText}>#{i + 1}</Text>
              </View>
            </TouchableOpacity>
            {isExpanded && (
              <View style={pl.picksList}>
                <View style={pl.golferHeader}>
                  <Text style={[pl.golferHText, { flex: 1 }]}>GOLFER</Text>
                  <Text style={[pl.golferHText, { width: 36 }]}>POS</Text>
                  <Text style={[pl.golferHText, { width: 40 }]}>SCORE</Text>
                  <Text style={[pl.golferHText, { width: 36, textAlign: 'right' }]}>PTS</Text>
                </View>
                {m.golfers.map((g, j) => (
                  <View key={j} style={[pl.golferRow, g.missedCut && { opacity: 0.5 }]}>
                    <View style={pl.golferNameRow}>
                      <HeadshotImage source={g.headshot || getHeadshotUrl(g.name)} style={pl.golferHeadshot} name={g.name} />
                      <Text style={[pl.golferName, g.missedCut && { textDecorationLine: 'line-through', textDecorationColor: COLORS.overPar }]} numberOfLines={1}>{g.name}</Text>
                    </View>
                    <Text style={pl.golferPos}>{g.position}</Text>
                    <Text style={[pl.golferScore, { color: typeof g.score === 'number' ? sColor(g.score) : COLORS.softGold }]}>
                      {typeof g.score === 'number' ? sc(g.score) : g.score}
                    </Text>
                    <Text style={[pl.golferPts, { color: g.points >= 0 ? COLORS.fairwayGreen : COLORS.overPar }]}>{g.points}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const pl = StyleSheet.create({
  // Standings table
  standingsCard: { marginHorizontal: 14, marginTop: 8, marginBottom: 10, backgroundColor: COLORS.cardBg, borderRadius: 14, overflow: 'hidden' },
  standingsHeader: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1.5, borderBottomColor: 'rgba(255,215,0,0.15)' },
  standingsHText: { fontFamily: UI_FONTS.semiBold, fontSize: 11, letterSpacing: 1, color: COLORS.softGold },
  standingsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 },
  standingsRowAlt: { backgroundColor: COLORS.azaleaGlow },
  standingsRank: { width: 28, fontFamily: NUM_FONTS.semiBold, fontSize: 14, color: COLORS.softGold },
  standingsName: { flex: 1, fontFamily: NAME_FONTS.semiBold, fontSize: 16, color: COLORS.cream },
  standingsPts: { width: 42, fontFamily: NUM_FONTS.bold, fontSize: 15, textAlign: 'right' },
  standingsProj: { width: 42, fontFamily: NUM_FONTS.regular, fontSize: 13, color: COLORS.softGold, textAlign: 'right' },
  standingsWin: { width: 42, fontFamily: NUM_FONTS.bold, fontSize: 13, color: COLORS.azaleaPink, textAlign: 'right' },
  // Member cards
  card: { marginHorizontal: 14, marginBottom: 10, backgroundColor: COLORS.cardBg, borderRadius: 14, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  memberName: { fontFamily: NAME_FONTS.semiBold, fontSize: 18, color: COLORS.cream },
  budget: { fontFamily: NUM_FONTS.regular, fontSize: 13, color: COLORS.softGold, marginTop: 2 },
  teamScore: { fontFamily: NUM_FONTS.medium, fontSize: 13, color: COLORS.softGold, marginTop: 3 },
  pickCount: { fontFamily: NUM_FONTS.bold, fontSize: 14, color: COLORS.azaleaPink },
  rankBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.azaleaSoft, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontFamily: NUM_FONTS.bold, fontSize: 14, color: COLORS.azaleaPink },
  picksList: { paddingHorizontal: 16, paddingBottom: 14 },
  pickRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.subtleBorder },
  pickHeadshot: { width: 28, height: 28, borderRadius: 14, marginRight: 10, backgroundColor: COLORS.cardBgHover },
  pickHeadshotEmpty: { width: 28, height: 28, borderRadius: 14, marginRight: 10, backgroundColor: COLORS.cardBgHover },
  pickName: { fontFamily: NAME_FONTS.regular, fontSize: 14, color: COLORS.cream, flex: 1 },
  pickPrice: { fontFamily: NUM_FONTS.semiBold, fontSize: 13, color: COLORS.gold },
  // Golfer rows in tournament mode
  golferHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: COLORS.subtleBorder },
  golferHText: { fontFamily: UI_FONTS.semiBold, fontSize: 10, letterSpacing: 1, color: 'rgba(200,184,138,0.5)', textAlign: 'center' },
  golferRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.subtleBorder },
  golferNameRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  golferHeadshot: { width: 26, height: 26, borderRadius: 13, marginRight: 8, backgroundColor: COLORS.cardBgHover },
  golferHeadshotEmpty: { width: 26, height: 26, borderRadius: 13, marginRight: 8, backgroundColor: COLORS.cardBgHover },
  golferName: { flex: 1, fontFamily: NAME_FONTS.regular, fontSize: 15, color: COLORS.cream },
  golferPos: { width: 36, fontFamily: NUM_FONTS.semiBold, fontSize: 13, color: COLORS.softGold, textAlign: 'center' },
  golferScore: { width: 40, fontFamily: NUM_FONTS.bold, fontSize: 14, textAlign: 'center' },
  golferPts: { width: 36, fontFamily: NUM_FONTS.bold, fontSize: 14, textAlign: 'right' },
  emptySlot: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.subtleBorder },
  emptyText: { fontFamily: UI_FONTS.regular, fontSize: 13, color: 'rgba(200,184,138,0.3)', fontStyle: 'italic' },
});

// ═══════════════════════════════════════
// PLAYERS
// ═══════════════════════════════════════
function PlayersScreen() {
  const { user, favorites } = React.useContext(UserContext);
  const [espnPlayers, setEspnPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  useEffect(() => {
    (async () => {
      const result = await getMastersField();
      setEspnPlayers(result.players || []);
      setLoading(false);
    })();
  }, []);

  const toggleFav = (name) => {
    if (!user) return;
    if (favorites.includes(name)) {
      removeFavorite(user.uid, name);
    } else {
      addFavorite(user.uid, name);
    }
  };

  // Build player list from MASTERS_FIELD with ESPN data merged
  const players = MASTERS_FIELD.map(fp => {
    const espn = espnPlayers.find(ep => ep.name && fp.name && ep.name.toLowerCase() === fp.name.toLowerCase());
    // Prefer local headshot for players without ESPN IDs, otherwise use ESPN
    const localHs = LOCAL_HEADSHOTS[fp.name];
    const headshot = localHs || (fp.espnId ? (espn?.headshot || getHeadshotUrl(fp.name)) : null);
    return { ...fp, headshot, id: espn?.id || fp.espnId, country: espn?.country || '', flagUrl: espn?.flagUrl || null };
  });

  // Favorites float to top
  const sorted = [...players].sort((a, b) => {
    const af = favorites.includes(a.name) ? 1 : 0;
    const bf = favorites.includes(b.name) ? 1 : 0;
    return bf - af;
  });

  return (
    <ScrollView style={{ flex: 1, paddingTop: 10 }}>
      {loading && <ActivityIndicator color={COLORS.gold} style={{ marginTop: 20 }} />}

      {sorted.map((p, i) => {
        const isFav = favorites.includes(p.name);
        return (
          <TouchableOpacity key={p.name} style={[ps.card, isFav && ps.cardFav]} activeOpacity={0.6} onPress={() => setSelectedPlayer(p)}>
            {p.headshot ? (
              <Image source={headshotSource(p.headshot)} style={ps.headshot} />
            ) : (
              <View style={ps.headshotPlaceholder}>
                <Text style={ps.headshotInitial}>{p.name.charAt(0)}</Text>
              </View>
            )}
            <Text style={ps.name} numberOfLines={1}>{p.name}{p.amateur ? ' (A)' : ''}</Text>
            <TouchableOpacity onPress={() => toggleFav(p.name)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[ps.star, isFav && ps.starActive]}>{isFav ? '\u2605' : '\u2606'}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        );
      })}
      <View style={{ height: 40 }} />

      <PlayerDetailModal
        visible={!!selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
        player={selectedPlayer}
      />
    </ScrollView>
  );
}
const ps = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 14, marginBottom: 6, backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 14 },
  cardFav: { borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)' },
  headshot: { width: 48, height: 48, borderRadius: 24, marginRight: 14, backgroundColor: COLORS.cardBgHover },
  headshotPlaceholder: { width: 48, height: 48, borderRadius: 24, marginRight: 14, backgroundColor: COLORS.cardBgHover, alignItems: 'center', justifyContent: 'center' },
  headshotInitial: { fontFamily: NAME_FONTS.semiBold, fontSize: 20, color: COLORS.softGold },
  name: { flex: 1, fontFamily: NAME_FONTS.semiBold, fontSize: 20, color: COLORS.cream },
  star: { fontSize: 22, color: 'rgba(200,184,138,0.3)', paddingLeft: 12 },
  starActive: { color: COLORS.gold },
});

// ═══════════════════════════════════════
// DRAFT
// ═══════════════════════════════════════
// ═══════════════════════════════════════
// COUNTDOWN TIMER HOOK
// ═══════════════════════════════════════
function useCountdown(targetDate) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    if (!targetDate) { setRemaining(''); return; }
    const update = () => {
      const diff = new Date(targetDate) - new Date();
      if (diff <= 0) { setRemaining('Closed'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  return remaining;
}

// ═══════════════════════════════════════
// BID VALIDATION
// ═══════════════════════════════════════
function validateBid(amount, playerName, memberId, myBids, myProposal, draftPicks, round) {
  const amtNum = parseInt(amount);
  if (isNaN(amtNum) || amtNum < AUCTION.minBid) return `Minimum bid is $${AUCTION.minBid}`;
  if (amtNum > AUCTION.maxBidPerPlayer) return `Maximum bid per player is $${AUCTION.maxBidPerPlayer}`;

  // Calculate remaining budget
  const myPicks = draftPicks[memberId] || [];
  const spent = myPicks.reduce((s, p) => s + (p.price || 0), 0);
  const budgetRemaining = AUCTION.totalBudget - spent;

  // Total of other active bids (exclude the one being edited)
  const otherBidsTotal = myBids
    .filter(b => b.playerName.toLowerCase() !== playerName.toLowerCase())
    .reduce((s, b) => s + (b.amount || 0), 0);

  if (amtNum + otherBidsTotal > budgetRemaining) {
    return `Over budget. You have $${budgetRemaining} remaining, $${otherBidsTotal} committed to other bids.`;
  }

  // Can't bid on already-won player
  const allDrafted = new Set();
  Object.values(draftPicks).forEach(picks => (picks || []).forEach(p => allDrafted.add(p.player.toLowerCase())));
  if (allDrafted.has(playerName.toLowerCase())) return 'This player was already won in a previous round';

  return null; // valid
}

// ═══════════════════════════════════════
// PROPOSE PLAYER MODAL
// ═══════════════════════════════════════
function ProposeModal({ visible, onClose, currentRound, draftedNames, draftPicks, memberId, uid }) {
  const { favorites } = React.useContext(UserContext);
  const [search, setSearch] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [bidAmount, setBidAmount] = useState('1');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const available = MASTERS_FIELD.filter(p => !draftedNames?.has(p.name.toLowerCase()));
  const filtered = search.length > 0
    ? available.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : available;

  const handleSubmit = async () => {
    if (!selectedPlayer || !memberId || !uid) return;
    const amtNum = parseInt(bidAmount) || 1;
    const err = validateBid(amtNum, selectedPlayer.name, memberId, [], null, draftPicks, currentRound);
    if (err) { setError(err); return; }

    setSubmitting(true);
    try {
      await submitProposal(uid, memberId, selectedPlayer.name, amtNum, currentRound);
      setSearch(''); setSelectedPlayer(null); setBidAmount('1'); setError('');
      onClose();
    } catch (e) {
      setError('Failed to submit proposal');
    }
    setSubmitting(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={bm.overlay}>
        <View style={bm.sheet}>
          <View style={bm.handle} />
          <Text style={bm.title}>Propose a Player</Text>
          <Text style={{ fontFamily: UI_FONTS.regular, fontSize: 13, color: COLORS.softGold, textAlign: 'center', marginBottom: 16 }}>
            Choose a golfer to put up for auction this round. You must place at least a $1 bid.
          </Text>

          {!selectedPlayer ? (
            <>
              <TextInput style={bm.input} placeholder="Search golfers..." placeholderTextColor="rgba(200,184,138,0.4)" value={search} onChangeText={setSearch} autoFocus />
              <ScrollView style={bm.list}>
                {filtered.slice(0, 20).map((p, i) => {
                  const isFav = favorites.includes(p.name);
                  const hs = getHeadshotUrl(p.name);
                  return (
                    <TouchableOpacity key={i} style={bm.listItem} onPress={() => { setSelectedPlayer(p); setError(''); }} activeOpacity={0.7}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <HeadshotImage source={hs} style={{ width: 28, height: 28, borderRadius: 14, marginRight: 10, backgroundColor: COLORS.cardBgHover }} name={p.name} />
                        <Text style={[bm.listName, isFav && { color: COLORS.gold }]}>{p.name}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          ) : (
            <View style={bm.bidSection}>
              <View style={bm.selectedRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <HeadshotImage source={getHeadshotUrl(selectedPlayer.name)} style={{ width: 36, height: 36, borderRadius: 18, marginRight: 12, backgroundColor: COLORS.cardBgHover }} name={selectedPlayer.name} />
                  <Text style={bm.selectedName}>{selectedPlayer.name}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedPlayer(null)}>
                  <Text style={bm.changeText}>Change</Text>
                </TouchableOpacity>
              </View>

              <Text style={bm.bidLabel}>Your opening bid ($1 – $70)</Text>
              <TextInput style={bm.bidInput} placeholder="$1" placeholderTextColor="rgba(200,184,138,0.4)" value={bidAmount} onChangeText={(t) => { setBidAmount(t); setError(''); }} keyboardType="number-pad" autoFocus />

              {error ? <Text style={bm.errorText}>{error}</Text> : null}

              <TouchableOpacity style={[bm.submitBtn, submitting && { opacity: 0.5 }]} onPress={handleSubmit} activeOpacity={0.8} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={bm.submitText}>Propose & Bid</Text>}
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={bm.cancelBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={bm.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════
// BID MODAL (for bidding on proposed players)
// ═══════════════════════════════════════
function BidOnPlayerModal({ visible, onClose, player, currentRound, myBids, myProposal, draftPicks, memberId, uid }) {
  const existingBid = myBids.find(b => b.playerName.toLowerCase() === (player?.playerName || '').toLowerCase());
  const isMyProposal = myProposal?.playerName?.toLowerCase() === (player?.playerName || '').toLowerCase();
  const [bidAmount, setBidAmount] = useState(existingBid ? String(existingBid.amount) : '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && existingBid) setBidAmount(String(existingBid.amount));
    else if (visible) setBidAmount('');
    setError('');
  }, [visible]);

  if (!player) return null;

  const handleSubmit = async () => {
    const amtNum = parseInt(bidAmount);
    const err = validateBid(amtNum, player.playerName, memberId, myBids, myProposal, draftPicks, currentRound);
    if (err) { setError(err); return; }

    setSubmitting(true);
    try {
      if (isMyProposal) {
        await updateProposalBid(memberId, player.playerName, amtNum, currentRound);
      } else {
        await submitBid(uid, memberId, player.playerName, amtNum, currentRound);
      }
      onClose();
    } catch (e) {
      setError('Failed to submit bid');
    }
    setSubmitting(false);
  };

  const handleWithdraw = async () => {
    if (isMyProposal) { setError("Can't withdraw your proposed player's bid (min $1)"); return; }
    setSubmitting(true);
    try {
      await withdrawBid(memberId, player.playerName, currentRound);
      onClose();
    } catch (e) {
      setError('Failed to withdraw');
    }
    setSubmitting(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={bm.overlay}>
        <View style={bm.sheet}>
          <View style={bm.handle} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <HeadshotImage source={getHeadshotUrl(player.playerName)} style={{ width: 48, height: 48, borderRadius: 24, marginRight: 14, backgroundColor: COLORS.cardBgHover }} name={player.playerName} />
            <View style={{ flex: 1 }}>
              <Text style={bm.title}>{player.playerName}</Text>
              <Text style={{ fontFamily: UI_FONTS.regular, fontSize: 12, color: COLORS.softGold }}>
                Proposed by {POOL_MEMBERS.find(m => m.id === player.poolMemberId)?.first || player.poolMemberId}
                {player.autoProposed ? ' (auto)' : ''}
              </Text>
            </View>
          </View>

          <Text style={bm.bidLabel}>{existingBid ? 'Update your bid' : 'Place your bid'} ($1 – $70)</Text>
          <TextInput style={bm.bidInput} placeholder="$" placeholderTextColor="rgba(200,184,138,0.4)" value={bidAmount} onChangeText={(t) => { setBidAmount(t); setError(''); }} keyboardType="number-pad" autoFocus />

          {error ? <Text style={bm.errorText}>{error}</Text> : null}

          <TouchableOpacity style={[bm.submitBtn, submitting && { opacity: 0.5 }]} onPress={handleSubmit} activeOpacity={0.8} disabled={submitting || !bidAmount}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={bm.submitText}>{existingBid ? 'Update Bid' : 'Place Bid'}</Text>}
          </TouchableOpacity>

          {existingBid && !isMyProposal && (
            <TouchableOpacity style={bm.withdrawBtn} onPress={handleWithdraw} activeOpacity={0.8} disabled={submitting}>
              <Text style={bm.withdrawText}>Withdraw Bid</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={bm.cancelBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={bm.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const bm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.darkGreen, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: '85%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(200,184,138,0.3)', alignSelf: 'center', marginBottom: 16 },
  title: { fontFamily: FONTS.semiBold, fontSize: 22, color: COLORS.cream, marginBottom: 4 },
  input: { fontFamily: UI_FONTS.regular, fontSize: 16, color: COLORS.cream, backgroundColor: COLORS.cardBg, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.subtleBorder },
  list: { maxHeight: 300 },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.subtleBorder },
  listName: { fontFamily: NAME_FONTS.regular, fontSize: 15, color: COLORS.cream },
  bidSection: { marginTop: 8 },
  selectedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  selectedName: { fontFamily: NAME_FONTS.semiBold, fontSize: 18, color: COLORS.cream },
  changeText: { fontFamily: UI_FONTS.medium, fontSize: 13, color: COLORS.azaleaPink },
  bidLabel: { fontFamily: UI_FONTS.regular, fontSize: 13, color: COLORS.softGold, marginBottom: 8 },
  bidInput: { fontFamily: NUM_FONTS.bold, fontSize: 32, color: COLORS.gold, backgroundColor: COLORS.cardBg, borderRadius: 12, padding: 16, textAlign: 'center', borderWidth: 1, borderColor: COLORS.subtleBorder, marginBottom: 12 },
  errorText: { fontFamily: UI_FONTS.regular, fontSize: 13, color: COLORS.overPar, textAlign: 'center', marginBottom: 12 },
  submitBtn: { backgroundColor: COLORS.azaleaPink, borderRadius: 24, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  submitText: { fontFamily: UI_FONTS.semiBold, fontSize: 16, color: '#fff', letterSpacing: 1 },
  withdrawBtn: { borderWidth: 1, borderColor: COLORS.overPar, borderRadius: 24, paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  withdrawText: { fontFamily: UI_FONTS.medium, fontSize: 14, color: COLORS.overPar },
  cancelBtn: { marginTop: 4, alignItems: 'center', paddingVertical: 10 },
  cancelText: { fontFamily: UI_FONTS.medium, fontSize: 14, color: COLORS.softGold },
});

// ═══════════════════════════════════════
// DRAFT RULES MODAL
// ═══════════════════════════════════════
function DraftRulesModal({ visible, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: COLORS.darkGreen, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: '90%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontFamily: FONTS.bold, fontSize: 22, color: COLORS.cream }}>How It Works</Text>
            <TouchableOpacity onPress={onClose}><Text style={{ fontFamily: UI_FONTS.semiBold, fontSize: 15, color: COLORS.azaleaPink }}>Done</Text></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={ri.heading}>The Draft</Text>
            <Text style={ri.body}>Each member starts with a <Text style={ri.bold}>$100 budget</Text> to build a team of <Text style={ri.bold}>5 golfers</Text> through 5 blind auction rounds.</Text>
            <Text style={ri.body}>Each round, propose ONE golfer to put up for auction. You must bid at least $1 on the player you propose — this bid can't be withdrawn.</Text>
            <Text style={ri.body}>Once players are proposed, everyone can bid on ANY proposed player. You can bid on multiple players per round.</Text>
            <Text style={ri.body}>Bid amounts are hidden. After the window closes, the highest bid on each player wins. Ties are coin flips.</Text>
            <Text style={ri.body}>If you don't propose by the 6-hour mark, the highest available golfer is auto-proposed for you at $1.</Text>

            <Text style={ri.heading}>Free Agency</Text>
            <Text style={ri.body}>After Round 5, anyone with fewer than 5 golfers enters free agency — pick from remaining players for free. Fewest golfers picks first.</Text>

            <Text style={ri.heading}>Scoring</Text>
            <Text style={ri.body}>Points are awarded based on leaderboard position at the end of each completed tournament round. Later rounds are worth more.</Text>

            <View style={ri.table}>
              <View style={ri.tableRow}>
                <Text style={[ri.th, { flex: 1 }]}>Position</Text>
                <Text style={ri.th}>Thu</Text><Text style={ri.th}>Fri</Text><Text style={ri.th}>Sat</Text><Text style={ri.th}>Sun</Text>
              </View>
              {[
                ['1st', 20, 25, 40, 75], ['2nd', 15, 20, 32, 55], ['3rd', 12, 16, 26, 45],
                ['T4-5', 10, 13, 20, 35], ['T6-10', 7, 9, 14, 22], ['T11-20', 4, 5, 8, 12],
                ['T21-30', 1, 2, 3, 5], ['T31-50', 0, 0, 0, 0], ['Below 50', -3, -4, '—', '—'],
                ['Missed cut', '', -15, 0, 0],
              ].map((row, i) => (
                <View key={i} style={[ri.tableRow, i % 2 === 0 && { backgroundColor: COLORS.azaleaGlow }]}>
                  <Text style={[ri.td, { flex: 1, color: COLORS.cream }]}>{row[0]}</Text>
                  <Text style={ri.td}>{row[1]}</Text><Text style={ri.td}>{row[2]}</Text><Text style={ri.td}>{row[3]}</Text><Text style={ri.td}>{row[4]}</Text>
                </View>
              ))}
            </View>

            <Text style={ri.heading}>Ties</Text>
            <Text style={ri.body}>When golfers are tied, their points are averaged across the tied positions, rounded to whole numbers.</Text>

            <Text style={ri.heading}>The Cut</Text>
            <Text style={ri.body}>Top 50 + ties make the cut after Friday. Missed cut = <Text style={ri.bold}>-15 points</Text> (applied once).</Text>

            <Text style={ri.heading}>Winning</Text>
            <Text style={ri.body}>Your team's total = sum of all 5 golfers' points across all 4 tournament rounds. Highest total wins.</Text>
            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const ri = StyleSheet.create({
  heading: { fontFamily: FONTS.semiBold, fontSize: 18, color: COLORS.gold, marginTop: 20, marginBottom: 8 },
  body: { fontFamily: UI_FONTS.regular, fontSize: 14, color: COLORS.cream, lineHeight: 22, marginBottom: 8 },
  bold: { fontFamily: UI_FONTS.bold, color: COLORS.gold },
  table: { marginTop: 8, marginBottom: 8, borderRadius: 10, overflow: 'hidden', backgroundColor: COLORS.cardBg },
  tableRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 12 },
  th: { fontFamily: UI_FONTS.semiBold, fontSize: 11, color: COLORS.softGold, width: 42, textAlign: 'center', letterSpacing: 0.5 },
  td: { fontFamily: NUM_FONTS.regular, fontSize: 13, color: COLORS.softGold, width: 42, textAlign: 'center' },
});

// ═══════════════════════════════════════
// FREE AGENCY SCREEN
// ═══════════════════════════════════════
function FreeAgencyView({ draftPicks, memberId, uid }) {
  const [claims, setClaims] = useState({});
  const countdown = useCountdown(FREE_AGENCY.close);

  useEffect(() => {
    const unsub = onFreeAgencyClaims(setClaims);
    return unsub;
  }, []);

  const myPicks = draftPicks[memberId] || [];
  const myNeeded = AUCTION.rosterSize - myPicks.length;
  const draftedNames = new Set();
  Object.values(draftPicks).forEach(picks => (picks || []).forEach(p => draftedNames.add(p.player.toLowerCase())));
  Object.keys(claims).forEach(name => draftedNames.add(name));

  const available = MASTERS_FIELD.filter(p => !draftedNames.has(p.name.toLowerCase()));

  const handleClaim = async (playerName) => {
    if (myNeeded <= 0) return;
    try {
      await claimFreeAgent(uid, memberId, playerName);
    } catch (e) {
      console.error('Claim failed:', e);
    }
  };

  return (
    <ScrollView style={{ flex: 1, paddingTop: 10 }}>
      <View style={dr.bannerSmall}>
        <Text style={dr.title}>Free Agency</Text>
        <Text style={{ fontFamily: UI_FONTS.medium, fontSize: 13, color: COLORS.fairwayGreen }}>{countdown}</Text>
        <Text style={{ fontFamily: UI_FONTS.regular, fontSize: 12, color: COLORS.softGold, marginTop: 4 }}>
          {myNeeded > 0 ? `You need ${myNeeded} more golfer${myNeeded > 1 ? 's' : ''}` : 'Your roster is full!'}
        </Text>
      </View>

      {available.map((p, i) => {
        const hs = getHeadshotUrl(p.name);
        return (
          <View key={p.name} style={[dr.faRow, i % 2 === 0 && { backgroundColor: COLORS.azaleaGlow }]}>
            <HeadshotImage source={hs} style={{ width: 32, height: 32, borderRadius: 16, marginRight: 10, backgroundColor: COLORS.cardBgHover }} name={p.name} />
            <Text style={{ flex: 1, fontFamily: NAME_FONTS.semiBold, fontSize: 16, color: COLORS.cream }}>{p.name}</Text>
            {myNeeded > 0 && (
              <TouchableOpacity style={dr.claimBtn} onPress={() => handleClaim(p.name)} activeOpacity={0.7}>
                <Text style={dr.claimText}>Claim</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════
// DRAFT SCREEN — MAIN
// ═══════════════════════════════════════
function DraftScreen() {
  const { user, profile } = React.useContext(UserContext);
  const [rulesVisible, setRulesVisible] = useState(false);
  const [proposeVisible, setProposeVisible] = useState(false);
  const [bidTarget, setBidTarget] = useState(null);
  const [draftPicks, setDraftPicks] = useState({});
  const [poolConfig, setPoolConfig] = useState({});
  const [proposals, setProposals] = useState([]);
  const [allBids, setAllBids] = useState([]);

  const memberId = profile?.poolMemberId;
  const currentRound = poolConfig.currentRound || 1;

  useEffect(() => {
    const unsub1 = onDraftPicks((data) => { setDraftPicks(data.picks || {}); });
    const unsub2 = onPoolConfig((config) => { setPoolConfig(config); });
    return () => { unsub1(); unsub2(); };
  }, []);

  // Listen to proposals and bids for current round
  useEffect(() => {
    if (poolConfig.phase !== 'DURING_DRAFT') { setProposals([]); setAllBids([]); return; }
    const unsub1 = onRoundProposals(currentRound, setProposals);
    const unsub2 = onRoundBids(currentRound, setAllBids);
    return () => { unsub1(); unsub2(); };
  }, [poolConfig.phase, currentRound]);

  const draftOpen = poolConfig.phase === 'DURING_DRAFT';
  const isFreeAgency = poolConfig.phase === 'FREE_AGENCY';
  const isDraftComplete = poolConfig.phase === 'DRAFT_COMPLETE' || poolConfig.phase === 'TOURNAMENT';
  const hasPicks = Object.values(draftPicks).some(picks => picks && picks.length > 0);
  const countdown = useCountdown(poolConfig.roundCloseTime);

  // Get list of already drafted player names
  const draftedNames = new Set();
  Object.values(draftPicks).forEach(picks => (picks || []).forEach(p => draftedNames.add(p.player.toLowerCase())));

  // My state
  const myPicks = draftPicks[memberId] || [];
  const myBudget = AUCTION.totalBudget - myPicks.reduce((s, p) => s + (p.price || 0), 0);
  const myRosterFull = myPicks.length >= AUCTION.rosterSize;
  const myProposal = proposals.find(p => p.poolMemberId === memberId);
  const myBids = allBids.filter(b => b.poolMemberId === memberId);

  // Free agency
  if (isFreeAgency) {
    return <FreeAgencyView draftPicks={draftPicks} memberId={memberId} uid={user?.uid} />;
  }

  // Schedule info
  const currentSchedule = DRAFT_SCHEDULE.find(s => s.round === currentRound);

  return (
    <ScrollView style={{ flex: 1, paddingTop: 10 }}>
      {/* Banner */}
      <ImageBackground source={IMAGES.hole12} style={dr.banner} imageStyle={{ opacity: 0.25, borderRadius: 14 }}>
        <View style={dr.bannerInner}>
          <Text style={dr.title}>Blind Auction Draft</Text>
          {draftOpen ? (
            <>
              <Text style={dr.statusOpen}>Round {currentRound} · Bidding Open</Text>
              <Text style={{ fontFamily: NUM_FONTS.bold, fontSize: 20, color: COLORS.gold, marginTop: 4 }}>{countdown}</Text>
              <Text style={{ fontFamily: UI_FONTS.regular, fontSize: 11, color: COLORS.softGold, marginTop: 2 }}>remaining</Text>
            </>
          ) : isDraftComplete ? (
            <Text style={dr.statusClosed}>Draft complete</Text>
          ) : (
            <>
              <Text style={dr.statusClosed}>Draft has not started yet</Text>
              {currentSchedule && (
                <Text style={{ fontFamily: UI_FONTS.regular, fontSize: 12, color: COLORS.softGold, marginTop: 4 }}>
                  Round {currentRound} opens {new Date(poolConfig.roundOpenTime || DRAFT_SCHEDULE[currentRound - 1]?.open).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                </Text>
              )}
            </>
          )}
          <TouchableOpacity style={dr.rulesBtn} onPress={() => setRulesVisible(true)} activeOpacity={0.7}>
            <Text style={dr.rulesText}>How it works</Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>

      {/* My status bar */}
      {draftOpen && memberId && (
        <View style={dr.statusBar}>
          <Text style={dr.statusBarText}>Budget: <Text style={{ fontFamily: NUM_FONTS.bold, color: COLORS.gold }}>${myBudget}</Text></Text>
          <Text style={dr.statusBarText}>Roster: <Text style={{ fontFamily: NUM_FONTS.bold, color: COLORS.azaleaPink }}>{myPicks.length}/{AUCTION.rosterSize}</Text></Text>
          <Text style={dr.statusBarText}>Bids: <Text style={{ fontFamily: NUM_FONTS.bold, color: COLORS.fairwayGreen }}>{myBids.length}</Text></Text>
        </View>
      )}

      {/* Propose CTA — only if draft open, I haven't proposed, and roster not full */}
      {draftOpen && !myProposal && !myRosterFull && (
        <TouchableOpacity style={dr.proposeCta} onPress={() => setProposeVisible(true)} activeOpacity={0.8}>
          <Text style={dr.proposeCtaText}>Propose your player for Round {currentRound}</Text>
          <Text style={{ fontFamily: UI_FONTS.regular, fontSize: 12, color: COLORS.softGold, marginTop: 4 }}>You must propose before you can bid on others</Text>
        </TouchableOpacity>
      )}

      {draftOpen && myProposal && (
        <View style={dr.proposedBadge}>
          <Text style={{ fontFamily: UI_FONTS.medium, fontSize: 12, color: COLORS.fairwayGreen }}>
            You proposed: {myProposal.playerName} (${myProposal.bidAmount})
          </Text>
        </View>
      )}

      {/* Proposed players cards */}
      {draftOpen && proposals.length > 0 && (
        <>
          <Text style={dr.secLabel}>Proposed Players — Round {currentRound}</Text>
          {proposals.map((prop) => {
            const hs = getHeadshotUrl(prop.playerName);
            const proposer = POOL_MEMBERS.find(m => m.id === prop.poolMemberId);
            // Bids on this player (visible: who has bid + count, but NOT amounts)
            const playerBids = allBids.filter(b => b.playerName.toLowerCase() === prop.playerName.toLowerCase());
            const myBidOnThis = myBids.find(b => b.playerName.toLowerCase() === prop.playerName.toLowerCase());
            const isMyProp = prop.poolMemberId === memberId;

            return (
              <TouchableOpacity key={prop.id} style={[dr.propCard, isMyProp && dr.propCardMine]} activeOpacity={0.7} onPress={() => setBidTarget(prop)}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <HeadshotImage source={hs} style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: COLORS.cardBgHover }} name={prop.playerName} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: NAME_FONTS.semiBold, fontSize: 18, color: COLORS.cream }}>{prop.playerName}</Text>
                    <Text style={{ fontFamily: UI_FONTS.regular, fontSize: 12, color: COLORS.softGold }}>
                      Proposed by {proposer?.first || prop.poolMemberId}{prop.autoProposed ? ' (auto)' : ''}
                    </Text>
                  </View>
                  {isMyProp && (
                    <View style={{ backgroundColor: COLORS.azaleaSoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontFamily: UI_FONTS.semiBold, fontSize: 10, color: COLORS.azaleaPink, letterSpacing: 0.5 }}>YOURS</Text>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                  <Text style={{ fontFamily: UI_FONTS.medium, fontSize: 12, color: COLORS.softGold }}>{playerBids.length} bid{playerBids.length !== 1 ? 's' : ''}</Text>
                  <View style={{ flexDirection: 'row', marginLeft: 8, flexWrap: 'wrap', flex: 1 }}>
                    {playerBids.map((b, i) => {
                      const bidder = POOL_MEMBERS.find(m => m.id === b.poolMemberId);
                      return (
                        <View key={i} style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginRight: 4, marginBottom: 2 }}>
                          <Text style={{ fontFamily: UI_FONTS.regular, fontSize: 10, color: COLORS.cream }}>{bidder?.first || b.poolMemberId}</Text>
                        </View>
                      );
                    })}
                  </View>
                  {myBidOnThis ? (
                    <Text style={{ fontFamily: NUM_FONTS.bold, fontSize: 14, color: COLORS.gold }}>Your bid: ${myBidOnThis.amount}</Text>
                  ) : (
                    <Text style={{ fontFamily: UI_FONTS.medium, fontSize: 12, color: COLORS.azaleaPink }}>Tap to bid</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </>
      )}

      {/* Draft results — resolved rounds */}
      {hasPicks && (
        <>
          <Text style={dr.secLabel}>Draft Results</Text>
          {POOL_MEMBERS.map(member => {
            const picks = draftPicks[member.id] || [];
            if (picks.length === 0) return null;
            const spent = picks.reduce((s, p) => s + (p.price || 0), 0);
            return (
              <View key={member.id} style={dr.roundCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <MemberAvatar member={member} size={26} />
                  <Text style={dr.memberName}>{member.first} {member.last}</Text>
                  <Text style={dr.budgetLeft}>${AUCTION.totalBudget - spent} left</Text>
                </View>
                {picks.map((pick, i) => {
                  const hs = getHeadshotUrl(pick.player);
                  return (
                    <View key={i} style={dr.slotRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <HeadshotImage source={hs} style={dr.pickHeadshot} name={pick.player} />
                        <Text style={dr.slotName}>{pick.player}</Text>
                      </View>
                      <Text style={dr.slotPrice}>${pick.price}</Text>
                      <Text style={{ fontFamily: UI_FONTS.regular, fontSize: 10, color: 'rgba(200,184,138,0.4)', marginLeft: 6 }}>R{pick.round}</Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </>
      )}

      {!hasPicks && !draftOpen && !isFreeAgency && (
        <View style={dr.emptyCard}>
          <Text style={dr.emptyText}>Draft results will appear here once bidding begins.</Text>
          <Text style={dr.emptySubtext}>Each member gets ${AUCTION.totalBudget} to bid on {AUCTION.rosterSize} golfers across {AUCTION.rounds} blind auction rounds.</Text>
        </View>
      )}

      {/* Round schedule */}
      {!isDraftComplete && (
        <View style={dr.scheduleCard}>
          <Text style={{ fontFamily: UI_FONTS.semiBold, fontSize: 12, color: COLORS.softGold, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>Round Schedule</Text>
          {DRAFT_SCHEDULE.map((s) => {
            const isActive = draftOpen && s.round === currentRound;
            const isResolved = (poolConfig.lastResolvedRound || 0) >= s.round;
            return (
              <View key={s.round} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                <Text style={{ fontFamily: NUM_FONTS.bold, fontSize: 14, color: isActive ? COLORS.gold : isResolved ? COLORS.fairwayGreen : COLORS.softGold, width: 20 }}>{s.round}</Text>
                <Text style={{ fontFamily: UI_FONTS.regular, fontSize: 12, color: isActive ? COLORS.cream : COLORS.softGold, flex: 1 }}>
                  {new Date(s.open).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true })} – {new Date(s.close).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}
                </Text>
                <Text style={{ fontFamily: UI_FONTS.medium, fontSize: 11, color: isActive ? COLORS.fairwayGreen : isResolved ? COLORS.fairwayGreen : COLORS.softGold }}>
                  {isActive ? 'OPEN' : isResolved ? 'DONE' : ''}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={{ height: 40 }} />

      <DraftRulesModal visible={rulesVisible} onClose={() => setRulesVisible(false)} />

      {draftOpen && (
        <>
          <ProposeModal
            visible={proposeVisible}
            onClose={() => setProposeVisible(false)}
            currentRound={currentRound}
            draftedNames={draftedNames}
            draftPicks={draftPicks}
            memberId={memberId}
            uid={user?.uid}
          />
          <BidOnPlayerModal
            visible={!!bidTarget}
            onClose={() => setBidTarget(null)}
            player={bidTarget}
            currentRound={currentRound}
            myBids={myBids}
            myProposal={myProposal}
            draftPicks={draftPicks}
            memberId={memberId}
            uid={user?.uid}
          />
        </>
      )}
    </ScrollView>
  );
}
const dr = StyleSheet.create({
  banner: { marginHorizontal: 14, marginTop: 4, borderRadius: 14, overflow: 'hidden' },
  bannerInner: { padding: 28, alignItems: 'center' },
  bannerSmall: { marginHorizontal: 14, marginTop: 4, backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 20, alignItems: 'center' },
  title: { fontFamily: FONTS.bold, fontSize: 26, color: COLORS.gold, letterSpacing: 1, marginBottom: 10 },
  statusOpen: { fontFamily: UI_FONTS.medium, fontSize: 13, color: COLORS.fairwayGreen, letterSpacing: 1 },
  statusClosed: { fontFamily: UI_FONTS.medium, fontSize: 13, color: COLORS.softGold, letterSpacing: 1 },
  rulesBtn: { marginTop: 14, paddingVertical: 8, paddingHorizontal: 20, borderWidth: 1, borderColor: COLORS.gold, borderRadius: 20 },
  rulesText: { fontFamily: UI_FONTS.medium, fontSize: 13, color: COLORS.gold, letterSpacing: 1 },
  statusBar: { flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: 14, marginTop: 10, backgroundColor: COLORS.cardBg, borderRadius: 10, padding: 12 },
  statusBarText: { fontFamily: UI_FONTS.regular, fontSize: 13, color: COLORS.softGold },
  proposeCta: { marginHorizontal: 14, marginTop: 10, backgroundColor: COLORS.azaleaSoft, borderWidth: 1, borderColor: COLORS.azaleaPink, borderRadius: 14, padding: 18, alignItems: 'center' },
  proposeCtaText: { fontFamily: UI_FONTS.semiBold, fontSize: 15, color: COLORS.azaleaPink },
  proposedBadge: { marginHorizontal: 14, marginTop: 10, backgroundColor: 'rgba(124,219,142,0.1)', borderRadius: 10, padding: 12, alignItems: 'center' },
  secLabel: { fontFamily: UI_FONTS.medium, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: COLORS.softGold, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 10 },
  propCard: { marginHorizontal: 14, marginBottom: 8, backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 16 },
  propCardMine: { borderWidth: 1, borderColor: 'rgba(212,114,156,0.3)' },
  roundCard: { marginHorizontal: 14, marginBottom: 10, backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 16 },
  memberName: { fontFamily: NAME_FONTS.semiBold, fontSize: 15, color: COLORS.cream, marginLeft: 8 },
  budgetLeft: { fontFamily: NUM_FONTS.regular, fontSize: 12, color: COLORS.softGold, marginLeft: 'auto' },
  slotRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderTopWidth: 1, borderTopColor: COLORS.subtleBorder },
  slotName: { fontFamily: NAME_FONTS.regular, fontSize: 15, color: COLORS.cream },
  slotPrice: { fontFamily: NUM_FONTS.bold, fontSize: 15, color: COLORS.gold },
  pickHeadshot: { width: 24, height: 24, borderRadius: 12, marginRight: 8, backgroundColor: COLORS.cardBgHover },
  emptyCard: { marginHorizontal: 14, marginTop: 20, backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 24, alignItems: 'center' },
  emptyText: { fontFamily: UI_FONTS.medium, fontSize: 15, color: COLORS.cream, textAlign: 'center', marginBottom: 8 },
  emptySubtext: { fontFamily: UI_FONTS.regular, fontSize: 13, color: COLORS.softGold, textAlign: 'center', lineHeight: 20 },
  scheduleCard: { marginHorizontal: 14, marginTop: 10, backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 16 },
  faRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.subtleBorder },
  claimBtn: { backgroundColor: COLORS.fairwayGreen, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 16 },
  claimText: { fontFamily: UI_FONTS.semiBold, fontSize: 12, color: COLORS.darkGreen },
});

// ═══════════════════════════════════════
// MODEL — clean tables, no bar charts
// ═══════════════════════════════════════
function ModelScreen() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [draftPicks, setDraftPicks] = useState({});

  useEffect(() => {
    const unsub = onDraftPicks((data) => {
      setDraftPicks(data.picks || {});
    });
    return unsub;
  }, []);

  const fetchData = useCallback(async () => {
    const r = await getLeaderboard();
    setLeaderboard(r.players || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchData(); }, []);

  const hasPicks = Object.values(draftPicks).some(picks => picks && picks.length > 0);

  const completedRounds = leaderboard.length > 0
    ? Math.max(...leaderboard.map(p => p.rounds?.length || 0))
    : 0;

  const standings = hasPicks
    ? calculatePoolStandings(POOL_MEMBERS, draftPicks, leaderboard, completedRounds)
    : [];

  if (!hasPicks) {
    return (
      <ScrollView style={{ flex: 1, paddingTop: 10 }}>
        <View style={mo.card}>
          <Text style={mo.cardTitle}>Projected Standings</Text>
          <Text style={mo.emptyText}>Standings will appear once the draft is complete.</Text>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, paddingTop: 10 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={COLORS.gold} />}>
      {/* Projected standings table */}
      <View style={mo.standingsCard}>
        <View style={mo.standingsHeader}>
          <Text style={[mo.hText, { width: 28 }]}>#</Text>
          <Text style={[mo.hText, { flex: 1 }]}>MEMBER</Text>
          <Text style={[mo.hText, { width: 44, textAlign: 'right' }]}>PTS</Text>
          <Text style={[mo.hText, { width: 44, textAlign: 'right' }]}>PROJ</Text>
          <Text style={[mo.hText, { width: 42, textAlign: 'right' }]}>WIN%</Text>
        </View>
        {loading ? <ActivityIndicator color={COLORS.gold} style={{ marginVertical: 20 }} /> :
          standings.map((m, i) => (
            <View key={m.id} style={[mo.standingsRow, i % 2 === 0 && mo.standingsRowAlt]}>
              <Text style={[mo.rank, i < 3 && { color: COLORS.gold }]}>{i + 1}</Text>
              <MemberAvatar member={m} size={24} />
              <Text style={mo.memberName}>{m.first} {m.last}</Text>
              <Text style={[mo.pts, { color: m.teamPoints >= 0 ? COLORS.fairwayGreen : COLORS.overPar }]}>{m.teamPoints}</Text>
              <Text style={mo.proj}>{m.teamProjected}</Text>
              <Text style={{ fontFamily: NUM_FONTS.bold, fontSize: 13, color: COLORS.azaleaPink, width: 42, textAlign: 'right' }}>{m.winPct != null ? `${m.winPct}%` : '-'}</Text>
            </View>
          ))}
      </View>

      {/* Member detail cards with golfer projections */}
      {!loading && standings.map((m, i) => (
        <View key={m.id} style={mo.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <MemberAvatar member={m} size={26} />
            <Text style={mo.cardTitle}>{m.first} {m.last}</Text>
            <Text style={{ fontFamily: NUM_FONTS.bold, fontSize: 14, color: COLORS.azaleaPink, marginLeft: 'auto' }}>Proj: {m.teamProjected}</Text>
          </View>
          <View style={mo.golferHeader}>
            <Text style={[mo.golferHText, { flex: 1 }]}>GOLFER</Text>
            <Text style={[mo.golferHText, { width: 36 }]}>POS</Text>
            <Text style={[mo.golferHText, { width: 40 }]}>PTS</Text>
            <Text style={[mo.golferHText, { width: 44, textAlign: 'right' }]}>PROJ</Text>
          </View>
          {m.golfers.map((g, j) => (
            <View key={j} style={[mo.golferRow, g.missedCut && { opacity: 0.5 }]}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                {(g.headshot || getHeadshotUrl(g.name)) ? (
                  <Image source={headshotSource(g.headshot || getHeadshotUrl(g.name))} style={pl.golferHeadshot} />
                ) : (
                  <View style={pl.golferHeadshotEmpty} />
                )}
                <Text style={[mo.golferName, g.missedCut && { textDecorationLine: 'line-through', textDecorationColor: COLORS.overPar }]} numberOfLines={1}>{g.name}</Text>
              </View>
              <Text style={mo.golferPos}>{g.position}</Text>
              <Text style={[mo.golferPts, { color: g.points >= 0 ? COLORS.fairwayGreen : COLORS.overPar }]}>{g.points}</Text>
              <Text style={[mo.golferProj, { color: g.projected >= 0 ? COLORS.softGold : COLORS.overPar }]}>{g.projected}</Text>
            </View>
          ))}
        </View>
      ))}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
const mo = StyleSheet.create({
  standingsCard: { marginHorizontal: 14, marginTop: 8, marginBottom: 10, backgroundColor: COLORS.cardBg, borderRadius: 14, overflow: 'hidden' },
  standingsHeader: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1.5, borderBottomColor: 'rgba(255,215,0,0.15)' },
  hText: { fontFamily: UI_FONTS.semiBold, fontSize: 11, letterSpacing: 1, color: COLORS.softGold },
  standingsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 },
  standingsRowAlt: { backgroundColor: COLORS.azaleaGlow },
  rank: { width: 28, fontFamily: NUM_FONTS.semiBold, fontSize: 14, color: COLORS.softGold },
  memberName: { flex: 1, fontFamily: NAME_FONTS.semiBold, fontSize: 16, color: COLORS.cream },
  pts: { width: 50, fontFamily: NUM_FONTS.bold, fontSize: 16, textAlign: 'right' },
  proj: { width: 50, fontFamily: NUM_FONTS.regular, fontSize: 14, color: COLORS.softGold, textAlign: 'right' },
  card: { marginHorizontal: 14, marginBottom: 10, backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 16 },
  cardTitle: { fontFamily: NAME_FONTS.semiBold, fontSize: 18, color: COLORS.cream },
  emptyText: { fontFamily: UI_FONTS.regular, fontSize: 14, color: COLORS.softGold, textAlign: 'center', lineHeight: 22, marginTop: 8 },
  golferHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: COLORS.subtleBorder },
  golferHText: { fontFamily: UI_FONTS.semiBold, fontSize: 10, letterSpacing: 1, color: 'rgba(200,184,138,0.5)', textAlign: 'center' },
  golferRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.subtleBorder },
  golferName: { flex: 1, fontFamily: NAME_FONTS.regular, fontSize: 15, color: COLORS.cream },
  golferPos: { width: 36, fontFamily: NUM_FONTS.semiBold, fontSize: 13, color: COLORS.softGold, textAlign: 'center' },
  golferPts: { width: 40, fontFamily: NUM_FONTS.bold, fontSize: 14, textAlign: 'center' },
  golferProj: { width: 44, fontFamily: NUM_FONTS.bold, fontSize: 14, textAlign: 'right' },
});

// ═══════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════
// App-level context for user data
const UserContext = React.createContext({ user: null, profile: null, favorites: [] });

export default function App() {
  const [user, setUser] = useState(null);         // Firebase auth user
  const [profile, setProfile] = useState(null);    // Firestore user profile
  const [authReady, setAuthReady] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [tab, setTab] = useState(0);
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium,
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
    CormorantGaramond_400Regular_Italic,
    SourceSerif4_400Regular,
    SourceSerif4_500Medium,
    SourceSerif4_600SemiBold,
    SourceSerif4_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  // Auto sign-in anonymously, then listen for auth state
  useEffect(() => {
    const unsub = onAuthChange(async (u) => {
      if (!u) {
        // Auto sign in anonymously
        try { await signInAnon(); } catch (e) { console.error('Anon sign-in failed:', e); }
        return;
      }
      setUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  // Listen for profile changes when logged in
  useEffect(() => {
    if (!user) { setProfileLoaded(false); return; }
    const unsub = onUserProfile(user.uid, (p) => {
      setProfile(p);
      setProfileLoaded(true);
    });
    return unsub;
  }, [user]);

  // Register for push notifications when logged in
  useEffect(() => {
    if (user) registerForPushNotifications(user.uid).catch(() => {});
  }, [user]);

  if (!fontsLoaded || !authReady || (user && !profileLoaded)) return <View style={[ms.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color={COLORS.gold} size="large" /></View>;

  // Signed in but no complete profile — show setup
  if (user && profileLoaded && !profile?.poolMemberId) return (
    <>
      <StatusBar barStyle="light-content" />
      <SetupScreen uid={user.uid} />
    </>
  );

  // Profile exists — show welcome or app
  const displayName = profile?.displayName || 'Guest';
  if (showWelcome) return (
    <>
      <StatusBar barStyle="light-content" />
      <WelcomeScreen userName={displayName} onEnter={() => setShowWelcome(false)} />
    </>
  );

  const screens = [LeaderboardScreen, PoolScreen, DraftScreen, PlayersScreen];
  const Screen = screens[tab];

  return (
    <UserContext.Provider value={{ user, profile, favorites: profile?.favorites || [] }}>
      <View style={ms.container}>
        <StatusBar barStyle="light-content" />
        <ImageBackground source={IMAGES.clubhouse} style={ms.hero}>
          <View style={ms.heroOverlay}>
            <TouchableOpacity onLongPress={() => setShowWelcome(true)} delayLongPress={2000} activeOpacity={1}>
              <Text style={ms.heroTitle}>The Masters Pool</Text>
            </TouchableOpacity>
          </View>
        </ImageBackground>
        <View style={ms.azaleaLine} />
        <TabBar active={tab} onPress={setTab} />
        <Screen />
      </View>
    </UserContext.Provider>
  );
}
const ms = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.green },
  hero: { height: 245, justifyContent: 'flex-end' },
  heroOverlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 18, backgroundColor: 'rgba(0,50,25,0.5)' },
  heroTitle: { fontFamily: FONTS.bold, fontSize: 30, color: COLORS.gold, letterSpacing: 1 },
  azaleaLine: { height: 2.5, backgroundColor: COLORS.azaleaPink, opacity: 0.5 },
});
