const logger = require('./logger');

/**
 * Product Relevance Utility
 * Filters out products that don't match the search intent
 * Prevents issues like "streamdeck" showing up when searching for "steamdeck"
 * or RAM sticks showing up when searching for "desktop 64g ram"
 */

class ProductRelevance {
  /**
   * Extract important keywords from search term
   */
  static extractKeywords(searchTerm) {
    // Normalize the search term
    const normalized = searchTerm.toLowerCase().trim();

    // Split into words and filter out common words
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'of']);
    const words = normalized.split(/\s+/).filter(word => !stopWords.has(word) && word.length > 0);

    return {
      original: searchTerm,
      normalized,
      words,
      // Extract numbers (like RAM sizes, storage, etc.)
      numbers: normalized.match(/\d+\s*(gb|tb|g|t|ram|core|ghz|inch|"\s)/gi) || []
    };
  }

  /**
   * Check if a product title is relevant to the search term
   */
  static isRelevant(productTitle, searchTerm, options = {}) {
    const { minScore = 0.4, strictMode = false } = options;

    if (!productTitle || !searchTerm) return false;

    const titleNormalized = productTitle.toLowerCase();
    const keywords = this.extractKeywords(searchTerm);

    // Calculate relevance score
    const score = this.calculateRelevanceScore(titleNormalized, keywords, strictMode);

    // Check for common mismatches
    if (this.isCommonMismatch(titleNormalized, keywords.normalized)) {
      logger.debug(`❌ Filtered out common mismatch: "${productTitle}" for search "${searchTerm}"`);
      return false;
    }

    const isRelevant = score >= minScore;

    if (!isRelevant) {
      logger.debug(`❌ Low relevance (${score.toFixed(2)}): "${productTitle.substring(0, 60)}..." for "${searchTerm}"`);
    } else {
      logger.debug(`✅ Relevant (${score.toFixed(2)}): "${productTitle.substring(0, 60)}..."`);
    }

    return isRelevant;
  }

  /**
   * Calculate relevance score (0-1)
   */
  static calculateRelevanceScore(titleNormalized, keywords, strictMode) {
    let score = 0;
    let maxScore = 0;

    // Check each keyword
    for (const keyword of keywords.words) {
      maxScore += 1;

      // Exact word match (highest score)
      const wordBoundaryRegex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (wordBoundaryRegex.test(titleNormalized)) {
        score += 1;
      }
      // Partial match (lower score, only in non-strict mode)
      else if (!strictMode && titleNormalized.includes(keyword)) {
        score += 0.5;
      }
    }

    // Check numbers (very important for specs)
    for (const number of keywords.numbers) {
      maxScore += 1;
      const numberNormalized = number.toLowerCase().replace(/\s+/g, '');
      const titleNoSpaces = titleNormalized.replace(/\s+/g, '');

      if (titleNoSpaces.includes(numberNormalized)) {
        score += 1;
      }
    }

    // Normalize score to 0-1 range
    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * Check for common product mismatches
   */
  static isCommonMismatch(titleNormalized, searchNormalized) {
    // Define mismatch patterns
    const mismatches = [
      // "steamdeck" vs "streamdeck" - completely different products
      {
        search: /\bsteam\s*deck\b/i,
        badMatch: /\bstream\s*deck\b/i
      },
      // "desktop" search should not return just RAM sticks, SSDs, or CPUs alone
      {
        search: /\bdesktop\b.*\b(ram|memory|storage|cpu|processor)\b/i,
        badMatch: /^(?!.*(desktop|tower|pc|computer|system)).*\b(memory\s+kit|ram\s+stick|ssd\s+drive|cpu\s+only)\b/i,
        requiresInTitle: ['desktop', 'tower', 'pc', 'computer', 'system']
      },
      // "laptop" search should not return just batteries, chargers, or accessories
      {
        search: /\blaptop\b/i,
        badMatch: /^(?!.*\blaptop\b).*(battery|charger|adapter|cable|case|bag)\b/i
      },
      // "monitor" search should not return monitor arms/stands alone
      {
        search: /\bmonitor\b/i,
        badMatch: /^(?!.*\b(monitor|display|screen)\b).*(arm|stand|mount|bracket)\b/i
      },
      // "phone" search should not return just cases, chargers
      {
        search: /\bphone\b/i,
        badMatch: /^(?!.*\bphone\b).*(case|cover|charger|cable|screen protector)\b/i
      },
      // "keyboard" should not return just keycaps or switches
      {
        search: /\bkeyboard\b/i,
        badMatch: /^(?!.*\bkeyboard\b).*(keycap|key\s*cap|switch|cable)\b/i
      }
    ];

    for (const mismatch of mismatches) {
      // Check if search term matches this pattern
      if (mismatch.search.test(searchNormalized)) {
        // Check if title is a bad match
        if (mismatch.badMatch.test(titleNormalized)) {
          // If there are required words, check if any are in the title
          if (mismatch.requiresInTitle) {
            const hasRequiredWord = mismatch.requiresInTitle.some(word =>
              new RegExp(`\\b${word}\\b`, 'i').test(titleNormalized)
            );
            if (!hasRequiredWord) {
              return true; // It's a mismatch
            }
          } else {
            return true; // It's a mismatch
          }
        }
      }
    }

    return false;
  }

  /**
   * Filter an array of products by relevance
   */
  static filterRelevantProducts(products, searchTerm, options = {}) {
    const { minScore = 0.4, strictMode = false } = options;

    logger.info(`🔍 Filtering ${products.length} products for relevance to "${searchTerm}"`);

    const relevantProducts = products.filter(product =>
      this.isRelevant(product.title, searchTerm, { minScore, strictMode })
    );

    const filtered = products.length - relevantProducts.length;
    if (filtered > 0) {
      logger.info(`📊 Filtered out ${filtered} irrelevant products. ${relevantProducts.length} remain.`);
    }

    return relevantProducts;
  }

  /**
   * Sort products by relevance score (highest first)
   */
  static sortByRelevance(products, searchTerm) {
    const keywords = this.extractKeywords(searchTerm);

    return products.map(product => ({
      ...product,
      relevanceScore: this.calculateRelevanceScore(product.title.toLowerCase(), keywords, false)
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
}

module.exports = ProductRelevance;
