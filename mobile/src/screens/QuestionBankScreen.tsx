import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';

import { colors, spacing, fontSize, borderRadius } from '../constants/theme';
import { getQuestionBank, getQuestionBankMeta } from '../services/api';
import { ListSkeleton } from '../components/SkeletonLoader';
import type {
  QuestionBankItem,
  QuestionBankCategory,
} from '../types/interview';

const DIFFICULTY_COLORS: Record<string, { bg: string; text: string }> = {
  easy: { bg: '#D1FAE5', text: '#065F46' },
  medium: { bg: '#FEF3C7', text: '#92400E' },
  hard: { bg: '#FEE2E2', text: '#991B1B' },
  expert: { bg: '#EDE9FE', text: '#5B21B6' },
};

const LIMIT = 20;

export default function QuestionBankScreen() {
  const [categories, setCategories] = useState<QuestionBankCategory[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [searchText, setSearchText] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    getQuestionBankMeta()
      .then((meta) => {
        setCategories(meta.categories);
        setTotalCount(meta.total);
      })
      .catch(() => {});
  }, []);

  const fetchQuestions = useCallback(
    async (p: number, append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(false);

      try {
        const res = await getQuestionBank({
          category: selectedCategory || undefined,
          difficulty: selectedDifficulty || undefined,
          search: activeSearch || undefined,
          page: p,
          limit: LIMIT,
        });
        setQuestions((prev) => (append ? [...prev, ...res.questions] : res.questions));
        setTotalPages(res.total_pages);
        setPage(p);
      } catch {
        if (!append) setError(true);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [selectedCategory, selectedDifficulty, activeSearch],
  );

  useEffect(() => {
    fetchQuestions(1);
  }, [fetchQuestions]);

  const handleSearch = () => {
    setActiveSearch(searchText);
  };

  const handleClearSearch = () => {
    setSearchText('');
    setActiveSearch('');
  };

  const handleLoadMore = () => {
    if (!loadingMore && page < totalPages) {
      fetchQuestions(page + 1, true);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const renderQuestion = ({ item }: { item: QuestionBankItem }) => {
    const isExpanded = expandedId === item.id;
    const diffStyle = DIFFICULTY_COLORS[item.difficulty.toLowerCase()] ?? { bg: '#F3F4F6', text: '#374151' };

    return (
      <View style={styles.card}>
        <View style={styles.cardMeta}>
          <Text style={styles.cardId}>{item.id}</Text>
          <View style={[styles.diffBadge, { backgroundColor: diffStyle.bg }]}>
            <Text style={[styles.diffText, { color: diffStyle.text }]}>{item.difficulty}</Text>
          </View>
          <View style={styles.topicBadge}>
            <Text style={styles.topicText}>{item.topic || item.category_label}</Text>
          </View>
        </View>

        <Text style={styles.questionText}>{item.question_text}</Text>

        <TouchableOpacity style={styles.expandBtn} onPress={() => toggleExpand(item.id)}>
          <Text style={styles.expandText}>{isExpanded ? 'Hide Answer' : 'Show Answer'}</Text>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.answerSection}>
            <View style={styles.answerCard}>
              <Text style={styles.answerLabel}>Model Answer</Text>
              <Text style={styles.answerText}>{item.answer}</Text>
            </View>

            {item.key_concepts.length > 0 && (
              <View style={styles.conceptsRow}>
                <Text style={styles.conceptsLabel}>Key Concepts</Text>
                <View style={styles.conceptsWrap}>
                  {item.key_concepts.map((c) => (
                    <View key={c} style={styles.conceptChip}>
                      <Text style={styles.conceptChipText}>{c}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const difficulties = ['', 'easy', 'medium', 'hard'];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Question Bank</Text>
        <Text style={styles.subtitle}>
          {totalCount.toLocaleString()} questions across {categories.length} categories
        </Text>
      </View>

      {/* Category pills */}
      <View style={styles.filterSection}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ slug: '', label: 'All', count: totalCount }, ...categories.map((c) => ({ slug: c.slug, label: c.label, count: c.count }))]}
          keyExtractor={(item) => item.slug}
          contentContainerStyle={styles.pillRow}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.pill, selectedCategory === item.slug && styles.pillSelected]}
              onPress={() => setSelectedCategory(item.slug)}
            >
              <Text style={[styles.pillText, selectedCategory === item.slug && styles.pillTextSelected]}>
                {item.label} ({item.count})
              </Text>
            </TouchableOpacity>
          )}
        />

        {/* Difficulty pills */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={difficulties}
          keyExtractor={(item) => item || 'all'}
          contentContainerStyle={styles.pillRow}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.pill, selectedDifficulty === item && styles.pillSelected]}
              onPress={() => setSelectedDifficulty(item)}
            >
              <Text style={[styles.pillText, selectedDifficulty === item && styles.pillTextSelected]}>
                {item || 'All Levels'}
              </Text>
            </TouchableOpacity>
          )}
        />

        {/* Search bar */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search questions..."
            placeholderTextColor={colors.textLight}
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
          {activeSearch ? (
            <TouchableOpacity onPress={handleClearSearch}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Questions list */}
      {loading ? (
        <ListSkeleton count={4} />
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorIcon}>!</Text>
          <Text style={styles.errorTitle}>Failed to load questions</Text>
          <Text style={styles.errorDesc}>Check your connection and try again.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchQuestions(1)}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : questions.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No questions found. Try adjusting your filters.</Text>
        </View>
      ) : (
        <FlatList
          data={questions}
          keyExtractor={(item) => item.id}
          renderItem={renderQuestion}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ padding: spacing.lg }} />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
  filterSection: { paddingBottom: spacing.sm },
  pillRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.xs },
  pill: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: fontSize.xs, color: colors.text, textTransform: 'capitalize' },
  pillTextSelected: { color: '#FFFFFF', fontWeight: '600' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  searchBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
  },
  searchBtnText: { color: '#FFFFFF', fontSize: fontSize.sm, fontWeight: '600' },
  clearText: { color: colors.textSecondary, fontSize: fontSize.sm, paddingHorizontal: spacing.sm },
  listContent: { padding: spacing.lg, paddingTop: spacing.sm },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  errorIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    color: colors.error,
    fontSize: fontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 48,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  errorTitle: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  errorDesc: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
  },
  retryBtnText: { color: '#FFFFFF', fontSize: fontSize.md, fontWeight: '600' },
  emptyText: { fontSize: fontSize.md, color: colors.textSecondary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm, alignItems: 'center' },
  cardId: { fontSize: fontSize.xs, color: colors.textLight, fontFamily: 'monospace' },
  diffBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.full },
  diffText: { fontSize: fontSize.xs, fontWeight: '600' },
  topicBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  topicText: { fontSize: fontSize.xs, color: colors.primary },
  questionText: { fontSize: fontSize.sm, color: colors.text, lineHeight: 22, marginBottom: spacing.sm },
  expandBtn: { paddingVertical: spacing.xs },
  expandText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary },
  answerSection: { marginTop: spacing.md, gap: spacing.md },
  answerCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  answerLabel: { fontSize: fontSize.xs, fontWeight: '600', color: '#065F46', marginBottom: spacing.xs },
  answerText: { fontSize: fontSize.sm, color: colors.text, lineHeight: 22 },
  conceptsRow: {},
  conceptsLabel: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs },
  conceptsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  conceptChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  conceptChipText: { fontSize: fontSize.xs, color: '#1D4ED8' },
});
