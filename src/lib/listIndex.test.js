import { indexAfterRemoval } from './listIndex';

describe('indexAfterRemoval', () => {
  it("shows the item that moved into the removed one's place", () => {
    expect(indexAfterRemoval(0, 3)).toBe(0);
    expect(indexAfterRemoval(1, 3)).toBe(1);
  });

  it('shows the new last item when the last one is removed', () => {
    expect(indexAfterRemoval(2, 3)).toBe(1);
  });

  it('closes when the only item is removed', () => {
    expect(indexAfterRemoval(0, 1)).toBeNull();
  });
});
