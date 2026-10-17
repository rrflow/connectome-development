//! Deterministic clusters for the estate graph.
//!
//! The Database lens can color records by cluster: groups of records that are
//! linked to each other more densely than to the rest of the estate. Clusters
//! are a Connectome presentation aid computed from the engine's relations with
//! Louvain modularity optimisation (Blondel, Guillaume, Lambiotte, and
//! Lefebvre, "Fast unfolding of communities in large networks", 2008). They
//! are not estate data. Nodes are visited in index order and ties keep the
//! earlier community, so one graph snapshot always yields one clustering.

use std::collections::BTreeMap;

/// Passes over every node within one level before that level is accepted.
const MAX_PASSES_PER_LEVEL: usize = 64;
/// Aggregation levels before the hierarchy is cut.
const MAX_LEVELS: usize = 32;
/// Smallest modularity improvement that continues a level.
const MIN_MODULARITY_GAIN: f64 = 1e-9;

/// One undirected weighted graph level. A self-loop appears once in its
/// node's neighbour list and counts once toward that node's degree.
struct Level {
    neighbours: Vec<Vec<(usize, f64)>>,
}

impl Level {
    fn len(&self) -> usize {
        self.neighbours.len()
    }

    fn degree(&self, node: usize) -> f64 {
        self.neighbours[node].iter().map(|(_, weight)| weight).sum()
    }

    fn self_loops(&self, node: usize) -> f64 {
        self.neighbours[node]
            .iter()
            .filter(|(neighbour, _)| *neighbour == node)
            .map(|(_, weight)| weight)
            .sum()
    }
}

/// Community bookkeeping for one level: `total` is the summed degree of each
/// community's members, `inner` the weight inside it (an inner edge twice, a
/// self-loop once).
struct Partition<'a> {
    level: &'a Level,
    membership: Vec<usize>,
    total: Vec<f64>,
    inner: Vec<f64>,
    degrees: Vec<f64>,
    self_loops: Vec<f64>,
    weight: f64,
}

impl<'a> Partition<'a> {
    fn singletons(level: &'a Level) -> Self {
        let degrees: Vec<f64> = (0..level.len()).map(|node| level.degree(node)).collect();
        let self_loops: Vec<f64> = (0..level.len())
            .map(|node| level.self_loops(node))
            .collect();
        Self {
            level,
            membership: (0..level.len()).collect(),
            total: degrees.clone(),
            inner: self_loops.clone(),
            weight: degrees.iter().sum(),
            degrees,
            self_loops,
        }
    }

    fn remove(&mut self, node: usize, community: usize, links: f64) {
        self.total[community] -= self.degrees[node];
        self.inner[community] -= 2.0 * links + self.self_loops[node];
    }

    fn insert(&mut self, node: usize, community: usize, links: f64) {
        self.total[community] += self.degrees[node];
        self.inner[community] += 2.0 * links + self.self_loops[node];
        self.membership[node] = community;
    }

    fn modularity(&self) -> f64 {
        self.total
            .iter()
            .zip(&self.inner)
            .filter(|(total, _)| **total > 0.0)
            .map(|(total, inner)| inner / self.weight - (total / self.weight).powi(2))
            .sum()
    }

    /// Link weight from `node` to each neighbouring community, in first-seen
    /// order with the node's own community first.
    fn neighbour_communities(&self, node: usize) -> Vec<(usize, f64)> {
        let own = self.membership[node];
        let mut links: Vec<(usize, f64)> = vec![(own, 0.0)];
        for &(neighbour, weight) in &self.level.neighbours[node] {
            if neighbour == node {
                continue;
            }
            let community = self.membership[neighbour];
            match links
                .iter_mut()
                .find(|(candidate, _)| *candidate == community)
            {
                Some(entry) => entry.1 += weight,
                None => links.push((community, weight)),
            }
        }
        links
    }

    /// Moves nodes between communities until no move improves modularity.
    /// Returns whether any node changed community.
    fn settle(&mut self) -> bool {
        if self.weight <= 0.0 {
            return false;
        }
        let mut moved_any = false;
        let mut modularity = self.modularity();
        for _ in 0..MAX_PASSES_PER_LEVEL {
            let mut moves = 0;
            for node in 0..self.level.len() {
                let own = self.membership[node];
                let candidates = self.neighbour_communities(node);
                self.remove(node, own, candidates[0].1);
                let mut best = candidates[0];
                let mut best_gain = 0.0;
                for &(community, links) in &candidates {
                    let gain = links - self.total[community] * self.degrees[node] / self.weight;
                    if gain > best_gain + MIN_MODULARITY_GAIN {
                        best = (community, links);
                        best_gain = gain;
                    }
                }
                self.insert(node, best.0, best.1);
                if best.0 != own {
                    moves += 1;
                }
            }
            let next = self.modularity();
            if moves == 0 {
                break;
            }
            moved_any = true;
            if next - modularity < MIN_MODULARITY_GAIN {
                break;
            }
            modularity = next;
        }
        moved_any
    }
}

/// Dense community numbers in order of each community's first member.
fn renumber(membership: &[usize]) -> (Vec<usize>, usize) {
    let mut numbers = BTreeMap::new();
    let mut dense = Vec::with_capacity(membership.len());
    for &community in membership {
        let next = numbers.len();
        dense.push(*numbers.entry(community).or_insert(next));
    }
    (dense, numbers.len())
}

/// The next level: one node per community, inner weight as its self-loop.
fn aggregate(level: &Level, membership: &[usize], communities: usize) -> Level {
    let mut weights: Vec<BTreeMap<usize, f64>> = vec![BTreeMap::new(); communities];
    for (node, neighbours) in level.neighbours.iter().enumerate() {
        for &(neighbour, weight) in neighbours {
            *weights[membership[node]]
                .entry(membership[neighbour])
                .or_insert(0.0) += weight;
        }
    }
    Level {
        neighbours: weights
            .into_iter()
            .map(|links| links.into_iter().collect())
            .collect(),
    }
}

/// Clusters for `nodes` nodes joined by undirected `links` (a pair may repeat;
/// each occurrence adds weight). Returns each node's cluster, numbered by
/// descending size with ties broken by each cluster's lowest node index.
pub fn clusters(nodes: usize, links: &[(usize, usize)]) -> Vec<usize> {
    let mut pairs: BTreeMap<(usize, usize), f64> = BTreeMap::new();
    for &(from, to) in links {
        if from < nodes && to < nodes {
            *pairs.entry((from.min(to), from.max(to))).or_insert(0.0) += 1.0;
        }
    }
    let mut neighbours = vec![Vec::new(); nodes];
    for (&(from, to), &weight) in &pairs {
        neighbours[from].push((to, weight));
        if from != to {
            neighbours[to].push((from, weight));
        }
    }
    let mut level = Level { neighbours };
    let mut membership: Vec<usize> = (0..nodes).collect();
    for _ in 0..MAX_LEVELS {
        let mut partition = Partition::singletons(&level);
        if !partition.settle() {
            break;
        }
        let (dense, communities) = renumber(&partition.membership);
        for community in &mut membership {
            *community = dense[*community];
        }
        level = aggregate(&level, &dense, communities);
    }

    let mut sizes: BTreeMap<usize, (usize, usize)> = BTreeMap::new();
    for (node, &community) in membership.iter().enumerate() {
        let entry = sizes.entry(community).or_insert((0, node));
        entry.0 += 1;
    }
    let mut order: Vec<(usize, usize, usize)> = sizes
        .into_iter()
        .map(|(community, (size, first))| (community, size, first))
        .collect();
    order.sort_by(|left, right| right.1.cmp(&left.1).then(left.2.cmp(&right.2)));
    let rank: BTreeMap<usize, usize> = order
        .iter()
        .enumerate()
        .map(|(rank, (community, _, _))| (*community, rank))
        .collect();
    membership
        .into_iter()
        .map(|community| rank[&community])
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Every pair inside `members` linked once.
    fn clique(members: std::ops::Range<usize>) -> Vec<(usize, usize)> {
        let members: Vec<usize> = members.collect();
        members
            .iter()
            .enumerate()
            .flat_map(|(index, &from)| members[index + 1..].iter().map(move |&to| (from, to)))
            .collect()
    }

    #[test]
    fn dense_groups_joined_by_one_link_become_two_clusters() {
        let mut links = clique(0..5);
        links.extend(clique(5..9));
        links.push((4, 5));
        let clusters = clusters(9, &links);
        assert!(clusters[..5].iter().all(|&cluster| cluster == 0));
        assert!(clusters[5..].iter().all(|&cluster| cluster == 1));
    }

    #[test]
    fn the_same_graph_always_yields_the_same_clusters() {
        let mut links = clique(0..4);
        links.extend(clique(4..8));
        links.extend(clique(8..12));
        links.extend([(3, 4), (7, 8), (11, 0), (2, 9)]);
        let first = clusters(12, &links);
        let mut reversed = links.clone();
        reversed.reverse();
        assert_eq!(first, clusters(12, &links));
        // Link order does not matter: links are merged into sorted pairs.
        assert_eq!(first, clusters(12, &reversed));
        assert_eq!(first.iter().max(), Some(&2));
    }

    #[test]
    fn unlinked_nodes_stay_alone_and_large_clusters_number_first() {
        // Node 0 is alone; nodes 1..=3 form a triangle; 4 and 5 a pair.
        let links = [(1, 2), (2, 3), (3, 1), (4, 5)];
        let clusters = clusters(6, &links);
        assert_eq!(clusters, [2, 0, 0, 0, 1, 1]);
    }

    #[test]
    fn repeated_self_and_out_of_range_links_are_bounded() {
        assert!(clusters(0, &[]).is_empty());
        assert_eq!(clusters(3, &[]), [0, 1, 2]);
        let clusters = clusters(3, &[(0, 0), (0, 1), (1, 0), (1, 0), (2, 7)]);
        assert_eq!(clusters[0], clusters[1]);
        assert_ne!(clusters[0], clusters[2]);
    }
}
